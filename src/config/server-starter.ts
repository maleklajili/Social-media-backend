import type { BaseController } from "../controllers/base/base-controller";
import { Registred } from "../routes/registred";
import { runSeeds } from "../seed/seed-runner";
import { createCorsResponse, handleOptionsRequest } from "../utils/cors";
import { ConnectionDatabase } from "./connection-database";
import { EnvLoader } from "./env";
import { ServerRequest } from "./interfaces/i-request";
import type { IServerStarter } from "./interfaces/i-server-starter";
import { Logger } from "./logger";
import { handleUploadsRequest } from "./uploads-response";
import { initSocket } from "../socket/socket-manager";

export class ServerStarter implements IServerStarter {
  private port: number;

  constructor(
    /* eslint-disable @typescript-eslint/no-explicit-any */
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

    // ✅ ON GARDE Bun.serve COMME DANS L'ANCIEN CODE !
    const server = Bun.serve({
      port: this.port,
      idleTimeout: 60, // ← AJOUTE ÇA : 60 secondes au lieu de 10
      fetch: async (req) => {
        // Gestion OPTIONS CORS
        if (req.method === "OPTIONS") {
          return handleOptionsRequest();
        }

        const url = new URL(req.url);

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

    // ✅ On initialise Socket.io avec le serveur Bun
    initSocket(server);

    Logger.success(`Server running at port: ${this.port}`, false);
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
