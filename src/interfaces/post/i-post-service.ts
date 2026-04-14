import type { ObjectId } from "mongodb";
import type { Post } from "../../models/post";

export interface IPostService {
  createPost(
    userId: ObjectId,
    post: Post,
    formData: FormData,
  ): Promise<Response>;
  updatePost(
    userId: ObjectId,
    postId: ObjectId,
    post: Post,
    formData: FormData,
  ): Promise<Response>;
  deletePost(userId: ObjectId, postId: ObjectId): Promise<Response>;
  getPostById(postId: ObjectId): Promise<Response>;
  getPostsByUserId(userId: ObjectId): Promise<Response>;

  getPostsByCommunity(
    communityId: ObjectId,
    page?: number,
    limit?: number,
    sort?: "recent" | "popular" | "trending",
  ): Promise<Response>;
  getFeed(
    userId: ObjectId,
    page: number,
    limit: number,
    filter?: string,
  ): Promise<Response>;
  votePost(
    userId: ObjectId,
    postId: ObjectId,
    vote: "up" | "down",
  ): Promise<Response>;
  commentPost(
    userId: ObjectId,
    postId: ObjectId,
    content: string,
    parentCommentId?: ObjectId,
  ): Promise<Response>;
  getPostComments(
    postId: ObjectId,
    page?: number,
    limit?: number,
    sort?: "recent" | "popular",
  ): Promise<Response>;
  getCommentReplies(
    commentId: ObjectId,
    page?: number,
    limit?: number,
  ): Promise<Response>;
  voteComment(
    userId: ObjectId,
    commentId: ObjectId,
    vote: "up" | "down",
  ): Promise<Response>;
  updateComment(
    userId: ObjectId,
    commentId: ObjectId,
    content: string,
  ): Promise<Response>;
  deleteComment(userId: ObjectId, commentId: ObjectId): Promise<Response>;
  savePost(userId: ObjectId, postId: ObjectId): Promise<Response>;
  unsavePost(userId: ObjectId, postId: ObjectId): Promise<Response>;
  getTrendingPosts(limit?: number): Promise<Response>;
  getStats(): Promise<Response>;
}
