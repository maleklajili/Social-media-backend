import { CollectionsManager } from "../models/base/collection-manager";
import type { Community } from "../models/community/community";
import type { User } from "../models/user";
import type { Post } from "../models/post";

export class SearchRepository {
  private communityCollection = CollectionsManager.communityCollection;
  private userCollection = CollectionsManager.userCollection;
  private postCollection = CollectionsManager.postCollection;

  async searchCommunities(query: string, limit: number): Promise<Community[]> {
    return this.communityCollection
      .find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
        isPublic: true,
      })
      .limit(limit)
      .toArray();
  }

  // Add this method for users
  async searchUsers(query: string, limit: number): Promise<User[]> {
    return this.userCollection
      .find({
        $or: [
          { userName: { $regex: query, $options: "i" } },
          { firstName: { $regex: query, $options: "i" } },
          { lastName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      })
      .limit(limit)
      .toArray();
  }

  // Add this method for posts
  async searchPosts(query: string, limit: number): Promise<Post[]> {
    return this.postCollection
      .find({
        $or: [
          { title: { $regex: query, $options: "i" } },
          { content: { $regex: query, $options: "i" } },
          { tags: { $regex: query, $options: "i" } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
