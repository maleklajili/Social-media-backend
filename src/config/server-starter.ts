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
    } catch (error) {
      Logger.error(`Database connection error: ${error}`);
      return;
    }
  }

  async seedRunner(): Promise<void> {
    await runSeeds();
  }

  async listen(port: number): Promise<void> {
    this.port = port;
    const router = new Registred(this.Controllers);
    await this.seedRunner();

    // Créer le serveur HTTP
    const httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`);

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

        // Gestion des uploads
        const uploadsResponse = await handleUploadsRequest(url);
        if (uploadsResponse) {
          res.writeHead(
            uploadsResponse.status,
            Object.fromEntries(uploadsResponse.headers),
          );
          if (uploadsResponse.body) {
            res.end(await uploadsResponse.text());
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
          res.end(await corsResponse.text());
        } else {
          res.end();
        }
      } catch (error) {
        console.error("Error handling request:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });

    // ✅ Attacher Socket.IO au même serveur
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
