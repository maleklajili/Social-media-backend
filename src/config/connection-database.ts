import { MongoClient } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import { Logger } from "./logger";

let client: MongoClient;

/** Resolve MongoDB Atlas SRV + TXT records via Cloudflare DNS over HTTPS.
 *  Returns a direct mongodb:// URL, bypassing the system DNS resolver. */
async function resolveAtlasUrlViaDoh(uri: string): Promise<string | null> {
  try {
    // Extract host from mongodb+srv://user:pass@host/db
    const srvMatch = uri.match(/mongodb\+srv:\/\/([^@]+)@([^/?]+)/);
    if (!srvMatch) return null;

    const credentials = srvMatch[1]; // user:pass
    const srvHost = srvMatch[2]; // cluster0.xxx.mongodb.net
    const dbAndOptions = uri.split(srvHost)[1] || ""; // /db?opts

    const dohBase = "https://cloudflare-dns.com/dns-query";
    const headers = { Accept: "application/dns-json" };

    // 1. Resolve SRV records
    const srvRes = await fetch(
      `${dohBase}?name=_mongodb._tcp.${srvHost}&type=SRV`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!srvRes.ok) return null;
    const srvData = (await srvRes.json()) as {
      Answer?: { data: string }[];
    };
    const srvAnswers = srvData.Answer ?? [];
    if (!srvAnswers.length) return null;

    const hosts = srvAnswers.map((a) => {
      const parts = a.data.trim().split(" ");
      const port = parts[2] ?? "27017";
      const target = (parts[3] ?? "").replace(/\.$/, "");
      return `${target}:${port}`;
    });

    // 2. Resolve TXT records for options (authSource, replicaSet)
    let extraOptions = "";
    try {
      const txtRes = await fetch(`${dohBase}?name=${srvHost}&type=TXT`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (txtRes.ok) {
        const txtData = (await txtRes.json()) as {
          Answer?: { data: string }[];
        };
        const txtAnswers = txtData.Answer ?? [];
        for (const a of txtAnswers) {
          const val = a.data.replace(/"/g, "").trim();
          if (val.includes("authSource") || val.includes("replicaSet")) {
            extraOptions = val.startsWith("?") ? val : `?${val}`;
            break;
          }
        }
      }
    } catch {
      // TXT optional — continue without
    }

    const hostList = hosts.join(",");
    const directUrl = `mongodb://${credentials}@${hostList}${dbAndOptions}${extraOptions ? (dbAndOptions.includes("?") ? "&" + extraOptions.replace(/^\?/, "") : extraOptions) : ""}`;
    Logger.info(`DoH resolved ${hosts.length} host(s): ${hosts.join(", ")}`);
    return directUrl;
  } catch (err) {
    Logger.error(`DoH resolution failed: ${err}`);
    return null;
  }
}

export class ConnectionDatabase {
  static async connect(uri: string): Promise<void> {
    if (!uri) {
      Logger.error(
        "MongoDB URI is not provided. Please set the MONGO_URI environment variable.",
      );
      return;
    }

    // Attempt 1: direct SRV connection
    try {
      client = await MongoClient.connect(uri, {
        serverSelectionTimeoutMS: 8000,
      });
      Logger.success("Database connected", false);
      CollectionsManager.initializeCollections(client);
      return;
    } catch (error) {
      Logger.error(`MongoDB connection error: ${error}`);
    }

    // Attempt 2: DNS-over-HTTPS fallback (when system DNS blocks SRV)
    if (uri.startsWith("mongodb+srv://")) {
      Logger.info(
        `DNS SRV failed — trying DNS over HTTPS for ${uri.split("@")[1]?.split("/")[0] ?? "..."}`,
      );
      const directUrl = await resolveAtlasUrlViaDoh(uri);
      if (directUrl) {
        try {
          client = await MongoClient.connect(directUrl, {
            serverSelectionTimeoutMS: 12000,
            tls: true,
          });
          Logger.success(
            "Database connected via DNS-over-HTTPS fallback",
            false,
          );
          CollectionsManager.initializeCollections(client);
          return;
        } catch (err) {
          Logger.error(
            `DoH fallback connection failed: ${err}\n  → Check Atlas cluster is RUNNING and your IP is whitelisted at cloud.mongodb.com`,
          );
        }
      }
    }
  }

  static async disconnect(): Promise<void> {
    try {
      if (client) {
        await client.close();
        Logger.info("MongoDB connection closed");
      }
    } catch (error) {
      Logger.error(`Error closing MongoDB connection: ${error}`);
      throw error;
    }
  }
}
