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

export class ServerStarter implements IServerStarter {
  private port: number;

  constructor(
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    private Controllers: (new () => BaseController<any>)[],
    port?: number,
  ) {
    this.port = port || 9000;
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

    // ✅ Démarrer le serveur Socket.IO séparé
    try {
      initSocketServer();
      Logger.success(`✅ Serveur Socket.IO démarré sur port 9000`, false);
    } catch (error) {
      Logger.error(`❌ Erreur démarrage Socket.IO: ${error}`, false);
    }

    /* const server = */
    Bun.serve({
      port: this.port,
      idleTimeout: 60,
      fetch: async (req) => {
        const url = new URL(req.url);

        // Ne pas traiter les requêtes socket.io ici
        if (url.pathname.startsWith("/socket.io/")) {
          return new Response("Socket.IO est sur le port 9000", {
            status: 404,
          });
        }

        // Gestion OPTIONS CORS
        if (req.method === "OPTIONS") {
          return handleOptionsRequest();
        }

        // Route de test
        if (url.pathname === "/") {
          return new Response("server is running", { status: 200 });
        }

        // Gestion des uploads
        const uploadsResponse = await handleUploadsRequest(url);
        if (uploadsResponse) return uploadsResponse;

        // Routes normales
        const enhancedRequest = new ServerRequest(req);
        const response = await router.router.handleRequest(enhancedRequest);
        return createCorsResponse(response);
      },
    });

    Logger.success(`✅ Serveur API démarré sur port: ${this.port}`, false);
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
