import { ObjectId } from "mongodb";
import { BaseService } from "../base/base-service";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Review } from "../../models/reviews/review";
import type { IReviewRepository } from "../../interfaces/review/i-review-repository";
import type { IReviewService } from "../../interfaces/review/i-review-service";
import type { ICompanyRepository } from "../../interfaces/company/i-company-repository";
import type { IUserRepository } from "../../interfaces/user/i-user-repository";
import { ResponseHelper } from "../../utils/response-helper";

export class ReviewServices
  extends BaseService<Review>
  implements IReviewService
{
  constructor(
    private reviewRepository: IReviewRepository,
    private companyRepository: ICompanyRepository,
    private userRepository: IUserRepository,
  ) {
    super(CollectionsManager.reviewCollection);
  }

  private async refreshCompanyStats(companyId: ObjectId): Promise<void> {
    const total = await this.reviewRepository.countReviewsByCompany(companyId);
    const avg = total
      ? await this.reviewRepository.getAverageRating(companyId)
      : 0;
    await this.companyRepository.updateCompanyStats(companyId, {
      averageRating: avg,
      reviewCount: total,
    });
  }

  async createOrUpdateReview(
    userId: ObjectId,
    companyId: string,
    data: { rating: number; comment?: string },
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }
      const companyObjectId = new ObjectId(companyId);

      const company =
        await this.companyRepository.getCompanyById(companyObjectId);
      if (!company) {
        return ResponseHelper.error("Company not found", 404);
      }

      if (data.rating < 1 || data.rating > 5) {
        return ResponseHelper.error("Rating must be between 1 and 5", 400);
      }

      const existing = await this.reviewRepository.findByUserAndCompany(
        userId,
        companyObjectId,
      );

      const now = new Date();
      if (existing) {
        existing.rating = data.rating;
        existing.comment = data.comment;
        existing.updatedAt = now;
        await this.reviewRepository.update(existing);
        // Mettre à jour les stats de l'entreprise
        await this.refreshCompanyStats(companyObjectId);
        return ResponseHelper.success(existing);
      } else {
        const newReview: Review = {
          _id: new ObjectId(),
          companyId: companyObjectId,
          userId,
          rating: data.rating,
          comment: data.comment,
          createdAt: now,
          updatedAt: now,
        } as Review;
        await this.reviewRepository.create(newReview);
        // Mettre à jour les stats de l'entreprise
        await this.refreshCompanyStats(companyObjectId);
        return ResponseHelper.success(newReview);
      }
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteReview(userId: ObjectId, reviewId: string): Promise<Response> {
    try {
      if (!ObjectId.isValid(reviewId)) {
        return ResponseHelper.error("Invalid review ID", 400);
      }
      const review = await this.reviewRepository.findById(
        new ObjectId(reviewId),
      );
      if (!review) {
        return ResponseHelper.error("Review not found", 404);
      }

      const company = await this.companyRepository.getCompanyById(
        review.companyId,
      );
      if (!company) {
        return ResponseHelper.error("Company not found", 404);
      }

      const isAuthor = review.userId.toString() === userId.toString();
      const isCompanyOwner = company.userId.toString() === userId.toString();

      if (!isAuthor && !isCompanyOwner) {
        return ResponseHelper.error("Access denied", 403);
      }

      const deleted = await this.reviewRepository.delete(
        new ObjectId(reviewId),
        userId,
      );
      if (!deleted) {
        return ResponseHelper.error("Review not found or access denied", 404);
      }

      await this.refreshCompanyStats(review.companyId);
      return ResponseHelper.success({ message: "Review deleted successfully" });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompanyReviews(
    companyId: string,
    page: number,
    limit: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentUserId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }
      const companyObjectId = new ObjectId(companyId);
      const skip = (page - 1) * limit;
      const reviews = await this.reviewRepository.getReviewsWithUserDetails(
        companyObjectId,
        skip,
        limit,
      );
      const total =
        await this.reviewRepository.countReviewsByCompany(companyObjectId);
      return ResponseHelper.success({
        data: reviews,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompanyReviewStats(companyId: string): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID", 400);
      }
      const companyObjectId = new ObjectId(companyId);

      const total =
        await this.reviewRepository.countReviewsByCompany(companyObjectId);
      const average = total
        ? await this.reviewRepository.getAverageRating(companyObjectId)
        : 0;
      const distribution =
        await this.reviewRepository.getRatingDistribution(companyObjectId);

      return ResponseHelper.success({
        averageRating: Math.round(average * 10) / 10,
        totalCount: total,
        distribution,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
