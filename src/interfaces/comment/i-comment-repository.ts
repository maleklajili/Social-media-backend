import { ObjectId } from "mongodb";
import type { Comment } from "../../models/comment";

export interface ICommentRepository {
  createComment(comment: Comment): Promise<Comment>;
  getCommentsByPostId(
    postId: ObjectId,
    page: number,
    limit: number,
    sort?: "recent" | "popular",
  ): Promise<Comment[]>;
  getCommentById(id: ObjectId): Promise<Comment | null>;
  updateComment(id: ObjectId, content: string): Promise<boolean>;
  deleteComment(id: ObjectId, userId: ObjectId): Promise<boolean>;
  softDeleteComment(id: ObjectId, moderatorId: ObjectId): Promise<boolean>;
  voteComment(
    commentId: ObjectId,
    userId: ObjectId,
    vote: "up" | "down",
  ): Promise<boolean>;
  incrementReplies(commentId: ObjectId): Promise<void>;
  getCommentsCount(postId: ObjectId): Promise<number>;
  getLastComment(postId: ObjectId): Promise<Comment | null>;
  getReplies(
    commentId: ObjectId,
    page?: number,
    limit?: number,
  ): Promise<Comment[]>;
}
