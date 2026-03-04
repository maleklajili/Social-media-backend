import { ObjectId } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Post } from "../../models/post";
import type { IPostRepository } from "../../interfaces/post/i-post-repository";

export class PostRepository implements IPostRepository {
  private collection = CollectionsManager.postCollection;
  // In your PostRepository class
  async getAllPosts(page: number = 1, limit: number = 10): Promise<Post[]> {
    const skip = (page - 1) * limit;

    return await this.collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  async addPost(post: Post): Promise<void> {
    await this.collection.insertOne(post);
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
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async getPostsByCommunity(communityId: ObjectId): Promise<Post[]> {
    return this.collection
      .find({ community: communityId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getFeedPosts(
    userId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Post[]> {
    const skip = (page - 1) * limit;

    // Get communities as strings
    const communityStrings = await this.getUserCommunities(userId);

    // Convert strings to ObjectId
    const communityObjectIds = communityStrings
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    // Build query
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (communityObjectIds.length > 0) {
      query.$or = [
        { userId: userId },
        { community: { $in: communityObjectIds } },
      ];
    } else {
      query.userId = userId;
    }

    return this.collection
      .find(query)
      .sort({ trendingScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
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

  async getSavedPosts(userId: ObjectId): Promise<Post[]> {
    return this.collection
      .find({ savedBy: userId })
      .sort({ createdAt: -1 })
      .toArray();
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

  async updateLastComment(
    postId: ObjectId,
    lastComment: Post["lastComment"],
  ): Promise<void> {
    await this.collection.updateOne({ _id: postId }, { $set: { lastComment } });
  }

  private async getUserCommunities(userId: ObjectId): Promise<string[]> {
    console.log(userId);
    // TODO: Récupérer les communautés de l'utilisateur
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
    content?: string,
  ): Promise<Post> {
    const originalPost = await this.getPostById(originalPostId);
    if (!originalPost) {
      throw new Error("Original post not found");
    }

    const sharePost: Post = {
      ...originalPost,
      _id: new ObjectId(),
      userId,
      originalPostId,
      content: content || originalPost.content,
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
      // Clear user-specific data
      userVotes: [],
      savedBy: [],
    };

    await this.collection.insertOne(sharePost);

    // Increment share count on original post
    await this.incrementShares(originalPostId, 1);

    return sharePost;
  }
}
