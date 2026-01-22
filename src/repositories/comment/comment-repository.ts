import { ObjectId, type Sort } from "mongodb";
import type { ICommentRepository } from "../../interfaces/comment/i-comment-repository";
import type { Comment } from "../../models/comment";
import { CollectionsManager } from "../../models/base/collection-manager";

export class CommentRepository implements ICommentRepository {
  private collection = CollectionsManager.commentCollection;

  async createComment(comment: Comment): Promise<Comment> {
    comment._id = new ObjectId();
    comment.createdAt = new Date();
    comment.updatedAt = new Date();
    comment.votes = 0;
    comment.repliesCount = 0;
    comment.isDeleted = false;

    await this.collection.insertOne(comment);
    return comment;
  }

  async getCommentsByPostId(
    postId: ObjectId,
    page: number = 1,
    limit: number = 10,
    sort: "recent" | "popular" = "recent",
  ): Promise<Comment[]> {
    const skip = (page - 1) * limit;
    const sortOption: Sort =
      sort === "popular" ? { votes: -1, createdAt: -1 } : { createdAt: -1 };

    return this.collection
      .find({
        postId,
        parentCommentId: null,
        isDeleted: false,
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getCommentById(id: ObjectId): Promise<Comment | null> {
    return this.collection.findOne({ _id: id, isDeleted: false });
  }

  async updateComment(id: ObjectId, content: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount === 1;
  }

  async deleteComment(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({
      _id: id,
      userId,
    });
    return result.deletedCount === 1;
  }

  async softDeleteComment(
    id: ObjectId,
    moderatorId: ObjectId,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: moderatorId,
          content: "[Commentaire supprimé]",
        },
      },
    );
    return result.modifiedCount === 1;
  }

  async voteComment(
    commentId: ObjectId,
    userId: ObjectId,
    vote: "up" | "down",
  ): Promise<boolean> {
    const comment = await this.getCommentById(commentId);
    if (!comment) return false;

    const existingVote = comment.userVotes?.find((v) =>
      v.userId.equals(userId),
    );
    const voteValue = vote === "up" ? 1 : -1;

    if (existingVote) {
      const oldVoteValue = existingVote.vote === "up" ? 1 : -1;

      if (existingVote.vote === vote) {
        // Annuler le vote
        await this.collection.updateOne(
          { _id: commentId },
          {
            $pull: { userVotes: { userId } },
            $inc: { votes: -oldVoteValue },
          },
        );
      } else {
        // Changer le vote
        await this.collection.updateOne(
          { _id: commentId, "userVotes.userId": userId },
          {
            $set: { "userVotes.$.vote": vote },
            $inc: { votes: voteValue - oldVoteValue },
          },
        );
      }
    } else {
      // Ajouter un nouveau vote
      await this.collection.updateOne(
        { _id: commentId },
        {
          $push: {
            userVotes: {
              userId,
              vote,
              createdAt: new Date(),
            },
          },
          $inc: { votes: voteValue },
        },
      );
    }

    return true;
  }

  async incrementReplies(commentId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: commentId },
      { $inc: { repliesCount: 1 } },
    );
  }

  async getCommentsCount(postId: ObjectId): Promise<number> {
    return this.collection.countDocuments({
      postId,
      isDeleted: false,
    });
  }

  async getLastComment(postId: ObjectId): Promise<Comment | null> {
    return this.collection
      .find({ postId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
  }

  async getReplies(
    commentId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Comment[]> {
    const skip = (page - 1) * limit;

    return this.collection
      .find({
        parentCommentId: commentId,
        isDeleted: false,
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
}
