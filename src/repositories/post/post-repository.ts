import { ObjectId, type Filter } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Post } from "../../models/post";
import type { IPostRepository } from "../../interfaces/post/i-post-repository";

export class PostRepository implements IPostRepository {
  private collection = CollectionsManager.postCollection;
  private userCollection = CollectionsManager.userCollection; // Déclaré une seule fois ici

  async getAllPosts(page: number = 1, limit: number = 10): Promise<Post[]> {
    const skip = (page - 1) * limit;
    return await this.collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getAllPostsCount(): Promise<number> {
    return this.collection.countDocuments();
  }

  async addPost(post: Post): Promise<void> {
    await this.collection.insertOne(post);
  }

  async getPostsByOwner(
    ownerId: ObjectId,
    ownerType: "user" | "company",
  ): Promise<Post[]> {
    return this.collection
      .find({
        ownerId: ownerId,
        ownerType: ownerType,
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async updatePost(post: Post): Promise<void> {
    const { _id, ...data } = post;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deletePost(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  async getPostById(id: ObjectId): Promise<Post | null> {
    return this.collection.findOne({ _id: id });
  }

  async getPostsByUserId(userId: ObjectId): Promise<Post[]> {
    return this.collection
      .find({
        $or: [
          {
            userId,
            $or: [{ sharedBy: { $exists: false } }, { sharedBy: { $size: 0 } }],
          },
          { sharedBy: userId },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getPostsByCommunity(communityId: ObjectId): Promise<Post[]> {
    return this.collection
      .find({
        community: communityId,
        originalPostId: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getFeedPosts(
    userId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Post[]> {
    const skip = (page - 1) * limit;

    const user = await this.userCollection.findOne({ _id: userId });
    const followedUsers = user?.following || [];
    const followedCompanies = user?.followingCompanies || [];

    // Si aucun abonnement, retourner un tableau vide
    if (followedUsers.length === 0 && followedCompanies.length === 0) {
      return [];
    }

    const conditions: Filter<Post>[] = [];
    if (followedUsers.length > 0) {
      conditions.push({
        ownerId: { $in: followedUsers },
        ownerType: "user" as const,
      });
    }

    if (followedCompanies.length > 0) {
      conditions.push({
        ownerId: { $in: followedCompanies },
        ownerType: "company" as const,
      });
    }

    // Ajouter les posts de l'utilisateur lui-même
    conditions.push({ ownerId: userId, ownerType: "user" as const });

    const query = { $or: conditions };

    return this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async countFeedPosts(userId: ObjectId): Promise<number> {
    const user = await this.userCollection.findOne({ _id: userId });
    const followedUsers = user?.following || [];
    const followedCompanies = user?.followingCompanies || [];

    if (followedUsers.length === 0 && followedCompanies.length === 0) {
      return 0;
    }

    const conditions: Filter<Post>[] = [];
    if (followedUsers.length > 0) {
      conditions.push({
        ownerId: { $in: followedUsers },
        ownerType: "user" as const,
      });
    }

    if (followedCompanies.length > 0) {
      conditions.push({
        ownerId: { $in: followedCompanies },
        ownerType: "company" as const,
      });
    }

    conditions.push({ ownerId: userId, ownerType: "user" as const });

    const query = { $or: conditions };

    return this.collection.countDocuments(query);
  }

  async incrementVotes(postId: ObjectId, increment: number): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      { $inc: { votes: increment } },
    );
  }

  async incrementComments(postId: ObjectId, increment: number): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      {
        $inc: { commentsCount: increment },
        $set: { lastActivityAt: new Date() },
      },
    );
  }

  async incrementViews(postId: ObjectId): Promise<void> {
    await this.collection.updateOne({ _id: postId }, { $inc: { views: 1 } });
  }

  async addToSaved(userId: ObjectId, postId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      {
        $addToSet: { savedBy: userId },
        $inc: { saves: 1 },
      },
    );
  }

  async removeFromSaved(userId: ObjectId, postId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      {
        $pull: { savedBy: userId },
        $inc: { saves: -1 },
      },
    );
  }

  async getTrendingPosts(limit: number = 10): Promise<Post[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.collection
      .find({
        createdAt: { $gte: oneWeekAgo },
        votes: { $gt: 10 },
      })
      .sort({ trendingScore: -1, votes: -1 })
      .limit(limit)
      .toArray();
  }
  async getSavedPosts(
    userId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Post[]> {
    const skip = (page - 1) * limit;
    return this.collection
      .find({ savedBy: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async countSavedPosts(userId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ savedBy: userId });
  }

  async getNewPosts(page: number = 1, limit: number = 10): Promise<Post[]> {
    const skip = (page - 1) * limit;
    return this.collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  async updateLastComment(
    postId: ObjectId,
    lastComment: Post["lastComment"],
  ): Promise<void> {
    await this.collection.updateOne({ _id: postId }, { $set: { lastComment } });
  }

  private async getUserCommunities(userId: ObjectId): Promise<string[]> {
    console.log(userId);
    return [];
  }

  async incrementShares(postId: ObjectId, increment: number): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      { $inc: { shares: increment } },
    );
  }

  async addToSharedBy(userId: ObjectId, postId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      {
        $addToSet: { sharedBy: userId },
        $inc: { shares: 1 },
      },
    );
  }

  async removeFromSharedBy(userId: ObjectId, postId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: postId },
      {
        $pull: { sharedBy: userId },
        $inc: { shares: -1 },
      },
    );
  }

  async getSharedPosts(userId: ObjectId): Promise<Post[]> {
    return this.collection
      .find({ sharedBy: userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async createSharePost(
    originalPostId: ObjectId,
    userId: ObjectId,
    avis?: string,
  ): Promise<Post> {
    const originalPost = await this.getPostById(originalPostId);
    if (!originalPost) {
      throw new Error("Original post not found");
    }

    const sharePost: Post = {
      ...originalPost,
      _id: new ObjectId(),
      userId: originalPost.userId,
      originalPostId,
      content: originalPost.content,
      avis: avis || "",
      type: originalPost.type,
      shares: 0,
      commentsCount: 0,
      votes: 0,
      views: 0,
      saves: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      sharedBy: [userId],
      userVotes: [],
      savedBy: [],
    };

    await this.collection.insertOne(sharePost);
    await this.incrementShares(originalPostId, 1);

    return sharePost;
  }
}
