import { ObjectId } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Review } from "../../models/reviews/review";
import type { IReviewRepository } from "../../interfaces/review/i-review-repository";

// Type pour un avis avec les détails de l'utilisateur
export interface ReviewWithUserDetails extends Review {
  user?: {
    _id: ObjectId;
    firstName?: string;
    lastName?: string;
    userName?: string;
    image?: string;
  };
}

export class ReviewRepository implements IReviewRepository {
  private collection = CollectionsManager.reviewCollection;

  async create(review: Review): Promise<void> {
    await this.collection.insertOne(review);
  }

  async update(review: Review): Promise<void> {
    const { _id, ...data } = review;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async delete(reviewId: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: reviewId, userId });
    return result.deletedCount === 1;
  }

  async findByCompanyId(
    companyId: ObjectId,
    skip: number,
    limit: number,
  ): Promise<Review[]> {
    return this.collection
      .find({ companyId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async countReviewsByCompany(companyId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ companyId });
  }

  async findByUserAndCompany(
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Review | null> {
    return this.collection.findOne({ userId, companyId });
  }

  async findById(reviewId: ObjectId): Promise<Review | null> {
    return this.collection.findOne({ _id: reviewId });
  }

  async getAverageRating(companyId: ObjectId): Promise<number> {
    const pipeline = [
      { $match: { companyId } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ];
    const result = await this.collection
      .aggregate<{ _id: null; avg: number }>(pipeline)
      .toArray();
    return result.length ? result[0]!.avg : 0;
  }

  async getRatingDistribution(
    companyId: ObjectId,
  ): Promise<{ [key: number]: number }> {
    const pipeline = [
      { $match: { companyId } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ];
    type AggregationResult = { _id: number; count: number };
    const result = await this.collection
      .aggregate<AggregationResult>(pipeline)
      .toArray();

    const distribution: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    result.forEach((item) => {
      distribution[item._id] = item.count;
    });
    return distribution;
  }

  async getReviewsWithUserDetails(
    companyId: ObjectId,
    skip: number,
    limit: number,
  ): Promise<ReviewWithUserDetails[]> {
    const pipeline = [
      { $match: { companyId } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          companyId: 1,
          rating: 1,
          comment: 1,
          createdAt: 1,
          updatedAt: 1,
          "user._id": 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.userName": 1,
          "user.image": 1,
        },
      },
    ];
    return this.collection.aggregate<ReviewWithUserDetails>(pipeline).toArray();
  }
}
