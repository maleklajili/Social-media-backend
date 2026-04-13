import { MongoClient } from "mongodb";

const MONGO_URI =
  "mongodb+srv://cvtech:cvtech@cluster0.asfulb4.mongodb.net/cv-techMA";

async function resolveViaDoh(uri: string) {
  const srvMatch = uri.match(/mongodb\+srv:\/\/([^@]+)@([^/?]+)/);
  if (!srvMatch) return null;
  const credentials = srvMatch[1];
  const srvHost = srvMatch[2];
  const dbAndOptions = uri.split(srvHost)[1] || "";
  const doh = "https://cloudflare-dns.com/dns-query";
  const headers = { Accept: "application/dns-json" };

  const srvRes = await fetch(`${doh}?name=_mongodb._tcp.${srvHost}&type=SRV`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!srvRes.ok) throw new Error("SRV DoH failed: " + srvRes.status);
  const srvData = (await srvRes.json()) as { Answer?: { data: string }[] };
  const hosts = (srvData.Answer ?? []).map((a) => {
    const p = a.data.trim().split(" ");
    return `${(p[3] ?? "").replace(/\.$/, "")}:${p[2] ?? "27017"}`;
  });
  console.log("✅ DoH resolved", hosts.length, "SRV record(s):");
  hosts.forEach((h) => console.log("   →", h));

  let extraOptions = "";
  const txtRes = await fetch(`${doh}?name=${srvHost}&type=TXT`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (txtRes.ok) {
    const txtData = (await txtRes.json()) as { Answer?: { data: string }[] };
    for (const a of txtData.Answer ?? []) {
      const val = a.data.replace(/"/g, "").trim();
      if (val.includes("authSource") || val.includes("replicaSet")) {
        extraOptions = val.startsWith("?") ? val : `?${val}`;
        console.log("   Options TXT:", val);
        break;
      }
    }
  }

  const hostList = hosts.join(",");
  const sep = dbAndOptions.includes("?") ? "&" : "?";
  const opts = extraOptions ? sep + extraOptions.replace(/^\?/, "") : "";
  return `mongodb://${credentials}@${hostList}${dbAndOptions}${opts}`;
}

async function main() {
  console.log("🔍 Testing MongoDB Connection...");
  console.log("📍 URI:", MONGO_URI.replace(/:[^:@]+@/, ":***@"));
  console.log();

  // 1. Internet check
  console.log("🌐 Checking internet connectivity...");
  try {
    const r = await fetch(
      "https://cloudflare-dns.com/dns-query?name=test.com&type=A",
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    console.log(
      "✅ Internet OK (cloudflare-dns.com reachable, status",
      r.status + ")",
    );
  } catch (e) {
    console.log("❌ No internet access:", e);
    process.exit(1);
  }
  console.log();

  // 2. Direct SRV attempt
  console.log("⏳ Attempt 1: Direct SRV connection...");
  try {
    const c = await MongoClient.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log("✅ Direct SRV connection succeeded!");
    await c.db("cv-techMA").command({ ping: 1 });
    console.log("✅ Ping OK — MongoDB is fully accessible");
    await c.close();
    process.exit(0);
  } catch (e) {
    console.log("❌ Direct SRV failed:", e instanceof Error ? e.message : e);
  }
  console.log();

  // 3. DoH fallback
  console.log("⏳ Attempt 2: DNS over HTTPS fallback...");
  try {
    const directUrl = await resolveViaDoh(MONGO_URI);
    if (!directUrl) throw new Error("DoH resolved 0 hosts");
    console.log();
    console.log("⏳ Connecting with DoH-resolved URL...");
    const c2 = await MongoClient.connect(directUrl, {
      serverSelectionTimeoutMS: 12000,
      tls: true,
    });
    await c2.db("cv-techMA").command({ ping: 1 });
    console.log("✅ DoH fallback works! MongoDB is fully accessible");
    await c2.close();
    process.exit(0);
  } catch (e) {
    console.log(
      "❌ DoH fallback also failed:",
      e instanceof Error ? e.message : e,
    );
    console.log("💡 The cluster is likely PAUSED or IP is not whitelisted.");
    console.log("   → https://cloud.mongodb.com → Resume cluster0");
    console.log("   → Network Access → Add Current IP Address");
    process.exit(1);
  }
}

main();
