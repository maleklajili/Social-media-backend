import type { ObjectId } from "mongodb";

export interface IReviewService {
  createOrUpdateReview(
    userId: ObjectId,
    companyId: string,
    data: { rating: number; comment?: string },
  ): Promise<Response>;

  deleteReview(userId: ObjectId, reviewId: string): Promise<Response>;

  getCompanyReviews(
    companyId: string,
    page: number,
    limit: number,
    currentUserId?: ObjectId,
  ): Promise<Response>;

  getCompanyReviewStats(companyId: string): Promise<Response>;
}
