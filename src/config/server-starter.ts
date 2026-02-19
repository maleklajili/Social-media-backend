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
import { createServer } from "http";
import { initSocket } from "../socket/socket-manager";

export class ServerStarter implements IServerStarter {
  private port = 3002;

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

    const httpServer = createServer(async (req, res) => {
      // Read the body from the incoming request
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const body = Buffer.concat(buffers).toString();

      // Convert NodeJS.IncomingHttpHeaders to a plain object for the Request constructor
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers[key] = Array.isArray(value) ? value.join(", ") : value;
        }
      }

      // Create the Request object with the body
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method || "GET",
        headers: headers,
        body: body || undefined, // Only include body if there is one
      });

      if (req.method === "OPTIONS") {
        const response = handleOptionsRequest();
        // Ajouter les headers CORS pour la pré-requête OPTIONS
        res.writeHead(response.status, {
          "Access-Control-Allow-Origin": "http://localhost:3001",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, ngrok-skip-browser-warning",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        });
        res.end(await response.text());
        return;
      }

      const url = new URL(request.url);

      if (url.pathname === "/") {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "http://localhost:3001",
          "Access-Control-Allow-Credentials": "true",
        });
        res.end("server is running");
        return;
      }

      const uploadsResponse = await handleUploadsRequest(url);
      if (uploadsResponse) {
        res.writeHead(uploadsResponse.status, {
          "Access-Control-Allow-Origin": "http://localhost:3001",
          "Access-Control-Allow-Credentials": "true",
        });
        res.end(await uploadsResponse.text());
        return;
      }

      const enhancedRequest = new ServerRequest(request);
      const response = await router.router.handleRequest(enhancedRequest);
      const finalResponse = createCorsResponse(response);

      // Ajouter les headers CORS à la réponse finale
      res.writeHead(finalResponse.status, {
        ...Object.fromEntries(finalResponse.headers.entries()),
        "Access-Control-Allow-Origin": "http://localhost:3001",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With, ngrok-skip-browser-warning",
      });
      res.end(await finalResponse.text());
    });

    httpServer.listen(this.port);
    initSocket(httpServer);

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
