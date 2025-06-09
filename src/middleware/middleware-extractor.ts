import { ServerRequest } from "../config/interfaces/i-request";
import type { ExpressMiddleware } from "../types/route-types";

export class MiddlewareExecutor {
  static isResponse(value: unknown): value is Response {
    return value instanceof Response;
  }

  static isRequest(value: unknown): value is ServerRequest {
    return value instanceof ServerRequest;
  }

  static async executeMiddlewareChain(
    middlewareChain: Array<ExpressMiddleware>,
    req: ServerRequest,
  ): Promise<ServerRequest | Response> {
    let currentRequest = req;

    for (const middleware of middlewareChain) {
      const result = await middleware(currentRequest);

      if (this.isResponse(result)) {
        return result;
      }

      if (this.isRequest(result)) {
        currentRequest = result;
      }
    }

    return currentRequest;
  }
}
//hfdhjfd
