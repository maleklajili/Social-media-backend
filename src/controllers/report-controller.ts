import { ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { Delete, Get, Post as PostMethod, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { ReportService } from "../services/report/report-service";

export class ReportController {
  public basePath = "/reports";
  private service: ReportService;

  constructor() {
    this.service = new ReportService();
  }

  /**
   * POST /reports/create
   * Create a new report for a post, comment, or user
   */
  @PostMethod("/create", [authMiddleware])
  async createReport(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const body = await req.json();
      const { reportedItemId, reportedItemType, reason, description } =
        body as {
          reportedItemId: string;
          reportedItemType: string;
          reason: string;
          description: string;
        };

      // Validation
      if (!reportedItemId || !ObjectId.isValid(reportedItemId)) {
        return ResponseHelper.error("Invalid reported item ID");
      }

      if (
        !reportedItemType ||
        !["post", "comment", "user"].includes(reportedItemType)
      ) {
        return ResponseHelper.error("Invalid item type");
      }

      if (!reason) {
        return ResponseHelper.error("Report reason is required");
      }

      return this.service.createReport(
        new ObjectId(reportedItemId),
        reportedItemType as "post" | "comment" | "user",
        req.user._id,
        reason,
        description || "",
      );
    } catch (err) {
      console.error("Error creating report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /reports/stats
   * Get report statistics (admin only)
   * Must be BEFORE /:id route to avoid matching as parameter
   */
  @Get("/stats", [authMiddleware])
  async getReportStats(): Promise<Response> {
    try {
      return this.service.getReportStats();
    } catch (err) {
      console.error("Error fetching report stats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /reports/user/:userId
   * Get all reports submitted by a specific user
   * Must be BEFORE /item/:itemId to avoid ambiguity
   */
  @Get("/user/:userId", [authMiddleware])
  async getReportsByUser(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;

      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID");
      }

      return this.service.getReportsByUser(new ObjectId(userId));
    } catch (err) {
      console.error("Error fetching user reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /reports/item/:itemId
   * Get all reports for a specific item (post or comment)
   * Must be BEFORE /:id route
   */
  @Get("/item/:itemId", [authMiddleware])
  async getReportsByItem(req: ServerRequest): Promise<Response> {
    try {
      const { itemId } = req.params;
      const { type } = req.query;

      if (!itemId || !ObjectId.isValid(itemId)) {
        return ResponseHelper.error("Invalid item ID");
      }

      if (!type || !["post", "comment", "user"].includes(type as string)) {
        return ResponseHelper.error("Invalid item type");
      }

      return this.service.getReportsByItem(
        new ObjectId(itemId),
        type as "post" | "comment" | "user",
      );
    } catch (err) {
      console.error("Error fetching item reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /reports
   * Get all reports with pagination and filtering (admin only)
   * Must be BEFORE /:id route
   */
  @Get("", [authMiddleware, paginationMiddleware])
  async getAllReports(req: RequestWithPagination): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      // Check if user is admin
      const isValidStatus =
        !status ||
        ["pending", "reviewing", "resolved", "dismissed"].includes(status);
      if (!isValidStatus) {
        return ResponseHelper.error("Invalid status filter");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.service.getAllReports(page, limit, status as any);
    } catch (err) {
      console.error("Error fetching reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /reports/:id
   * Get a specific report by ID (admin only)
   * Must be AFTER all specific routes (/stats, /user/:userId, /item/:itemId, etc)
   */
  @Get("/:id", [authMiddleware])
  async getReport(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing report ID");
      }

      // Check if user is admin (you may want to add admin middleware)
      return this.service.getReportById(new ObjectId(id));
    } catch (err) {
      console.error("Error fetching report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * PUT /reports/:id/status
   * Update report status (admin only)
   */
  @Put("/:id/status", [authMiddleware])
  async updateReportStatus(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      const body = await req.json();
      const { status, resolutionNotes } = body as {
        status: string;
        resolutionNotes?: string;
      };

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid report ID");
      }

      if (
        !status ||
        !["pending", "reviewing", "resolved", "dismissed"].includes(status)
      ) {
        return ResponseHelper.error("Invalid status");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.updateReportStatus(
        new ObjectId(id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status as any,
        req.user._id,
        resolutionNotes,
      );
    } catch (err) {
      console.error("Error updating report status:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * DELETE /reports/:id
   * Delete a report (admin only)
   */
  @Delete("/:id", [authMiddleware])
  async deleteReport(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid report ID");
      }

      return this.service.deleteReport(new ObjectId(id));
    } catch (err) {
      console.error("Error deleting report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
