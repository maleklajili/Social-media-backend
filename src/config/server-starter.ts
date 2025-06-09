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

export class ServerStarter implements IServerStarter {
  private port = 6000;

  constructor(
    /* eslint-disable @typescript-eslint/no-explicit-any */
    private Controllers: (new () => BaseController<any>)[],
    port?: number,
  ) {
    if (port) this.port = port;
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
    Bun.serve({
      port: this.port,
      fetch: async (req) => {
        if (req.method === "OPTIONS") {
          return handleOptionsRequest();
        }
        const url = new URL(req.url);

        if (url.pathname === "/") {
          return new Response("server is running", { status: 200 });
        }
        const uploadsResponse = await handleUploadsRequest(url);
        if (uploadsResponse) return uploadsResponse;
        else {
          const enhancedRequest = new ServerRequest(req);
          const response = await router.router.handleRequest(enhancedRequest);
          return createCorsResponse(response);
        }
      },
    });

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
