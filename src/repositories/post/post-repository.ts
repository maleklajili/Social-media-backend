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

  async getPostsByCommunity(communityId: string): Promise<Post[]> {
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

    return this.collection
      .find({
        $or: [
          { userId: userId },
          { community: { $in: await this.getUserCommunities(userId) } },
        ],
      })
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
}
