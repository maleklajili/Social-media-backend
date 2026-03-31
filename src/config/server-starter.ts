// server-starter.ts
import type { BaseController } from "../controllers/base/base-controller";
import { Registred } from "../routes/registred";
import { runSeeds } from "../seed/seed-runner";
import { initSocketServer } from "../socket/socket-manager";
import { createCorsResponse, handleOptionsRequest } from "../utils/cors";
import { ConnectionDatabase } from "./connection-database";
import { EnvLoader } from "./env";
import { ServerRequest } from "./interfaces/i-request";
import type { IServerStarter } from "./interfaces/i-server-starter";
import { Logger } from "./logger";
import { handleUploadsRequest } from "./uploads-response";
import http from "http";
import path from "path";
import { existsSync, promises as fs } from "fs";
import type { HeadersInit } from "bun";

export class ServerStarter implements IServerStarter {
  private port: number;

  constructor(
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    private Controllers: (new () => BaseController<any>)[],
    port?: number,
  ) {
    this.port = port || 6000;
  }

  async connection(): Promise<void> {
    try {
      await ConnectionDatabase.connect(EnvLoader.uri);
      Logger.success("✅ Database connected successfully", false);
    } catch (error) {
      Logger.error(`Database connection error: ${error}`);
      throw error;
    }
  }

  async seedRunner(): Promise<void> {
    try {
      await runSeeds();
      Logger.success("✅ Seeds executed successfully", false);
    } catch (error) {
      Logger.error(`Seed execution error: ${error}`, false);
    }
  }

  /**
   * Gère les requêtes de fichiers statiques (images, etc.)
   */
  private async handleStaticFile(url: URL): Promise<Response | null> {
    // Chemins possibles pour les fichiers statiques
    const staticPaths = ["/uploads/", "/images/", "/static/", "/public/"];
    const isStaticRequest = staticPaths.some((path) =>
      url.pathname.startsWith(path),
    );

    if (!isStaticRequest) {
      return null;
    }

    // Déterminer le dossier de base pour les fichiers statiques
    let basePath = "";
    if (url.pathname.startsWith("/uploads/")) {
      basePath = path.join(process.cwd(), "uploads");
    } else if (url.pathname.startsWith("/images/")) {
      basePath = path.join(process.cwd(), "images");
    } else if (url.pathname.startsWith("/static/")) {
      basePath = path.join(process.cwd(), "static");
    } else if (url.pathname.startsWith("/public/")) {
      basePath = path.join(process.cwd(), "public");
    }

    // Construire le chemin complet du fichier
    const relativePath = url.pathname.substring(
      url.pathname.indexOf("/", 1) + 1,
    );
    const filePath = path.join(basePath, relativePath);

    // Sécurité: normaliser le chemin et éviter les attaques path traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(basePath)) {
      Logger.warn(
        `Security: Attempted path traversal to ${normalizedPath}`,
        false,
      );
      return new Response("Forbidden", { status: 403 });
    }

    try {
      // Vérifier si le fichier existe
      if (existsSync(normalizedPath)) {
        const fileBuffer = await fs.readFile(normalizedPath);
        const ext = path.extname(normalizedPath).toLowerCase();

        // Map des types MIME
        const mimeTypes: { [key: string]: string } = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".bmp": "image/bmp",
          ".ico": "image/x-icon",
          ".txt": "text/plain",
          ".pdf": "application/pdf",
          ".mp4": "video/mp4",
          ".mp3": "audio/mpeg",
          ".css": "text/css",
          ".js": "application/javascript",
          ".json": "application/json",
          ".xml": "application/xml",
        };

        const contentType = mimeTypes[ext] || "application/octet-stream";

        // Ajouter des en-têtes de cache
        const headers: HeadersInit = {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000", // 1 an pour les fichiers statiques
          "Access-Control-Allow-Origin": "*",
        };

        // Ajouter des en-têtes spécifiques pour les images
        if (contentType.startsWith("image/")) {
          headers["Accept-Ranges"] = "bytes";
        }

        Logger.debug(
          `Serving static file: ${normalizedPath} (${contentType})`,
          false,
        );
        return new Response(fileBuffer, { headers });
      }
    } catch (error) {
      Logger.error(
        `Error serving static file ${normalizedPath}: ${error}`,
        false,
      );
    }

    return null;
  }

  async listen(port: number): Promise<void> {
    this.port = port;
    const router = new Registred(this.Controllers);
    await this.seedRunner();

    // Créer le serveur HTTP avec Node.js (plus stable pour les fichiers statiques)
    const httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`);

        // Log des requêtes (optionnel, pour déboguer)
        if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          console.log(`📸 Image request: ${url.pathname}`);
        }

        // Gestion OPTIONS CORS
        if (req.method === "OPTIONS") {
          const corsResponse = handleOptionsRequest();
          res.writeHead(
            corsResponse.status,
            Object.fromEntries(corsResponse.headers),
          );
          res.end();
          return;
        }

        // Route de test
        if (url.pathname === "/") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("server is running");
          return;
        }

        // Gestion des fichiers statiques (images, etc.)
        const staticResponse = await this.handleStaticFile(url);
        if (staticResponse) {
          const headers = Object.fromEntries(staticResponse.headers);
          const body = await staticResponse.arrayBuffer();
          res.writeHead(staticResponse.status, headers);
          res.end(Buffer.from(body));
          return;
        }

        // Gestion des uploads
        const uploadsResponse = await handleUploadsRequest(url);
        if (uploadsResponse) {
          res.writeHead(
            uploadsResponse.status,
            Object.fromEntries(uploadsResponse.headers),
          );
          if (uploadsResponse.body) {
            const body = await uploadsResponse.arrayBuffer();
            res.end(Buffer.from(body));
          } else {
            res.end();
          }
          return;
        }

        // Convertir la requête Node en Request Web API
        const body = req.method !== "GET" && req.method !== "HEAD" ? req : null;
        const webRequest = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          headers: req.headers as any,
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          body: body as any,
        });

        // Routes normales
        const enhancedRequest = new ServerRequest(webRequest);
        const response = await router.router.handleRequest(enhancedRequest);
        const corsResponse = createCorsResponse(response);
        res.writeHead(
          corsResponse.status,
          Object.fromEntries(corsResponse.headers),
        );
        if (corsResponse.body) {
          const body = await corsResponse.arrayBuffer();
          res.end(Buffer.from(body));
        } else {
          res.end();
        }
      } catch (error) {
        console.error("Error handling request:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });

    // Attacher Socket.IO au même serveur
    try {
      initSocketServer(httpServer);
      Logger.success(
        `✅ Serveur Socket.IO attaché au serveur principal`,
        false,
      );
    } catch (error) {
      Logger.error(`❌ Erreur attachement Socket.IO: ${error}`, false);
    }

    // Écouter sur le port
    httpServer.listen(this.port, () => {
      Logger.success(
        `✅ Serveur API et Socket.IO démarrés sur port: ${this.port}`,
        false,
      );
      Logger.info(
        `📁 Dossier uploads: ${path.join(process.cwd(), "uploads")}`,
        false,
      );
      Logger.info(`🌐 Accès API: http://localhost:${this.port}`, false);
      //Logger.info(`🔌 Socket.IO: ws://localhost:${this.port}/socket.io/`, false);
    });
  }

  async start(): Promise<void> {
    try {
      await this.connection();
      await this.listen(this.port);
    } catch (error) {
      Logger.error(`Failed to start server: ${error}`, true);
      process.exit(1);
    }
  }
}
