import type { ObjectId } from "mongodb";
import type { Post } from "../../models/post";

export interface IPostRepository {
  getAllPosts(page: number, limit: number): Promise<Post[]>;
  addPost(post: Post): Promise<void>;
  updatePost(post: Post): Promise<void>;
  deletePost(id: ObjectId, userId: ObjectId): Promise<boolean>;
  getPostById(id: ObjectId): Promise<Post | null>;
  getPostsByUserId(userId: ObjectId): Promise<Post[]>;
  getPostsByCommunity(communityId: ObjectId): Promise<Post[]>;
  getFeedPosts(userId: ObjectId, page: number, limit: number): Promise<Post[]>;
  incrementVotes(postId: ObjectId, increment: number): Promise<void>;
  incrementComments(postId: ObjectId, increment: number): Promise<void>;
  incrementViews(postId: ObjectId): Promise<void>;
  addToSaved(userId: ObjectId, postId: ObjectId): Promise<void>;
  removeFromSaved(userId: ObjectId, postId: ObjectId): Promise<void>;
  getSavedPosts(userId: ObjectId): Promise<Post[]>;
  getTrendingPosts(limit: number): Promise<Post[]>;
  updateLastComment(
    postId: ObjectId,
    lastComment: Post["lastComment"],
  ): Promise<void>;
  // Share methods
  incrementShares(postId: ObjectId, increment: number): Promise<void>;
  addToSharedBy(userId: ObjectId, postId: ObjectId): Promise<void>;
  removeFromSharedBy(userId: ObjectId, postId: ObjectId): Promise<void>;
  getSharedPosts(userId: ObjectId): Promise<Post[]>;
  createSharePost(
    originalPostId: ObjectId,
    userId: ObjectId,
    content?: string,
  ): Promise<Post>;
}
