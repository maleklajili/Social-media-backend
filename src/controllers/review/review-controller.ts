import { Collection, ObjectId } from "mongodb";
import type { ServerRequest } from "../../config/interfaces/i-request";
import { authMiddleware } from "../../middleware/aut-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Review } from "../../models/reviews/review";
import { Delete, Get, Post } from "../../routes/router-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { BaseController } from "../base/base-controller";
import { ReviewServices } from "../../services/review/review-services";
import { ReviewRepository } from "../../repositories/review/review-repository";
import { CompanyRepository } from "../../repositories/company-repository";
import { userRepository } from "../../repositories/user-repository";

export class ReviewController extends BaseController<Review, ReviewServices> {
  constructor() {
    super("/reviews");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Review> {
    return CollectionsManager.reviewCollection;
  }

  protected createService(): ReviewServices {
    return new ReviewServices(
      new ReviewRepository(),
      new CompanyRepository(),
      new userRepository(),
    );
  }

  @Post("/company/:companyId", [authMiddleware])
  async createOrUpdateReview(req: ServerRequest): Promise<Response> {
    try {
      const { companyId } = req.params;
      if (!companyId || !ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const body = (await req.json()) as { rating: number; comment?: string };
      if (!body || typeof body.rating !== "number") {
        return ResponseHelper.error("Rating is required", 400);
      }

      return this.service.createOrUpdateReview(req.user._id, companyId, body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:reviewId", [authMiddleware])
  async deleteReview(req: ServerRequest): Promise<Response> {
    try {
      const { reviewId } = req.params;
      if (!reviewId || !ObjectId.isValid(reviewId)) {
        return ResponseHelper.error("Invalid review ID", 400);
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.deleteReview(req.user._id, reviewId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/company/:companyId", [authMiddleware]) // plus de paginationMiddleware
  async getCompanyReviews(req: ServerRequest): Promise<Response> {
    try {
      const { companyId } = req.params;
      if (!companyId || !ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }

      // Lire page et limit depuis la query string
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const currentUserId = req.user?._id;

      return this.service.getCompanyReviews(
        companyId,
        page,
        limit,
        currentUserId,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/company/:companyId/stats", [authMiddleware])
  async getCompanyReviewStats(req: ServerRequest): Promise<Response> {
    try {
      const { companyId } = req.params;
      if (!companyId || !ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }

      return this.service.getCompanyReviewStats(companyId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
