// controllers/transaction-controller.ts
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { Get } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";
import { userRepository } from "../repositories/user-repository";
import type { TransactionType } from "../models/transaction";

export class TransactionController {
  private service: TransactionService;

  constructor() {
    this.service = new TransactionService(
      new TransactionRepository(),
      new userRepository(),
    );
  }

  @Get("/transactions", [authMiddleware, paginationMiddleware])
  async getTransactions(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const page = req.pagination?.page || 1;
      const limit = req.pagination?.limit || 20;

      return await this.service.getUserTransactions(req.user._id, page, limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/transactions/balance", [authMiddleware])
  async getBalance(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return await this.service.getUserBalance(req.user._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/transactions/:type", [authMiddleware])
  async getTransactionsByType(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { type } = req.params;
      if (!type || !["earned", "spent", "purchased"].includes(type)) {
        return ResponseHelper.error("Invalid transaction type");
      }

      return await this.service.getTransactionsByType(
        req.user._id,
        type as TransactionType,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
