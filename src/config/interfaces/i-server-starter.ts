import type { ServerRequest } from "./i-request";

export interface IServerStarter {
  listen: (port: number) => Promise<void>;
  start: () => Promise<void>;
  connection: () => Promise<void>;
  seedRunner: () => Promise<void>;
}

// interfaces/i-request-handler.ts
export interface IRequestHandler {
  handleRequest(request: ServerRequest): Promise<Response>;
}

// interfaces/i-database-connector.ts
export interface IDatabaseConnector {
  connect(uri: string): Promise<void>;
}
