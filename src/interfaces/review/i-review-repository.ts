import type { ObjectId } from "mongodb";
import type { Review } from "../../models/reviews/review";
import type { ReviewWithUserDetails } from "../../repositories/review/review-repository";

export interface IReviewRepository {
  create(review: Review): Promise<void>;
  update(review: Review): Promise<void>;
  delete(reviewId: ObjectId, userId: ObjectId): Promise<boolean>;
  findByCompanyId(
    companyId: ObjectId,
    skip: number,
    limit: number,
  ): Promise<Review[]>;
  countReviewsByCompany(companyId: ObjectId): Promise<number>;
  findByUserAndCompany(
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Review | null>;
  findById(reviewId: ObjectId): Promise<Review | null>;
  getAverageRating(companyId: ObjectId): Promise<number>;
  getRatingDistribution(
    companyId: ObjectId,
  ): Promise<{ [key: number]: number }>;
  getReviewsWithUserDetails(
    companyId: ObjectId,
    skip: number,
    limit: number,
  ): Promise<ReviewWithUserDetails[]>;
}
