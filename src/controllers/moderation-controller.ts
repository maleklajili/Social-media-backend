import { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import { BaseController } from "./base/base-controller";
import { BaseService } from "../services/base/base-service";
import type { Post } from "../models/post";
import { ResponseHelper } from "../utils/response-helper";
import { Get, Put } from "../routes/router-manager";
import type { ServerRequest } from "../config/interfaces/i-request";
import { ContentModeratorClient } from "../utils/content-moderator-client";
import { authMiddleware } from "../middleware/aut-middleware";

export class ModerationController extends BaseController<Post> {
  constructor() {
    super("/moderation");
    this.initializeService(this.createService());
  }

  protected initializeCollection() {
    return CollectionsManager.postCollection;
  }

  protected createService() {
    return new BaseService<Post>(CollectionsManager.postCollection);
  }

  /**
   * GET /moderation/flagged-posts - Get all flagged posts
   */
  @Get("/flagged-posts", [authMiddleware])
  async getFlaggedPosts(_req: ServerRequest): Promise<Response> {
    try {
      const posts = await CollectionsManager.postCollection
        .find({ flagged: true })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return ResponseHelper.success({ posts, count: posts.length });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /moderation/flagged-users - Get all flagged users
   */
  @Get("/flagged-users", [authMiddleware])
  async getFlaggedUsers(_req: ServerRequest): Promise<Response> {
    try {
      const users = await CollectionsManager.userCollection
        .find({ isFlagged: true })
        .project({ password: 0 })
        .sort({ fakeScore: -1 })
        .limit(50)
        .toArray();

      return ResponseHelper.success({ users, count: users.length });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /moderation/stats - Get moderation statistics
   */
  @Get("/stats", [authMiddleware])
  async getStats(_req: ServerRequest): Promise<Response> {
    try {
      const [flaggedPosts, flaggedUsers, totalPosts, totalUsers] =
        await Promise.all([
          CollectionsManager.postCollection.countDocuments({ flagged: true }),
          CollectionsManager.userCollection.countDocuments({ isFlagged: true }),
          CollectionsManager.postCollection.countDocuments(),
          CollectionsManager.userCollection.countDocuments(),
        ]);

      return ResponseHelper.success({
        flaggedPosts,
        flaggedUsers,
        totalPosts,
        totalUsers,
        toxicityRate:
          totalPosts > 0
            ? Math.round((flaggedPosts / totalPosts) * 100 * 100) / 100
            : 0,
        fakeUserRate:
          totalUsers > 0
            ? Math.round((flaggedUsers / totalUsers) * 100 * 100) / 100
            : 0,
      });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /moderation/post/:id/approve - Approve a flagged post
   */
  @Put("/post/:id/approve", [authMiddleware])
  async approvePost(id: ObjectId, _req: ServerRequest): Promise<Response> {
    try {
      const result = await CollectionsManager.postCollection.updateOne(
        { _id: id },
        {
          $set: {
            flagged: false,
            moderationStatus: "approved",
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return ResponseHelper.notFound("Post not found");
      }

      return ResponseHelper.success({ approved: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /moderation/post/:id/reject - Reject a flagged post (soft-delete)
   */
  @Put("/post/:id/reject", [authMiddleware])
  async rejectPost(id: ObjectId, _req: ServerRequest): Promise<Response> {
    try {
      const result = await CollectionsManager.postCollection.updateOne(
        { _id: id },
        {
          $set: {
            flagged: true,
            moderationStatus: "rejected",
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return ResponseHelper.notFound("Post not found");
      }

      return ResponseHelper.success({ rejected: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /moderation/user/:id/ban - Ban a flagged user
   */
  @Put("/user/:id/ban", [authMiddleware])
  async banUser(id: ObjectId, req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await req.json()) as any;
      const reason = body?.reason || "Compte suspect détecté par l'IA";

      const result = await CollectionsManager.userCollection.updateOne(
        { _id: id },
        {
          $set: {
            isBanned: true,
            banReason: reason,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return ResponseHelper.notFound("User not found");
      }

      return ResponseHelper.success({ banned: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /moderation/user/:id/unban - Unban a user
   */
  @Put("/user/:id/unban", [authMiddleware])
  async unbanUser(id: ObjectId, _req: ServerRequest): Promise<Response> {
    try {
      const result = await CollectionsManager.userCollection.updateOne(
        { _id: id },
        {
          $set: {
            isBanned: false,
            isFlagged: false,
            banReason: undefined,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return ResponseHelper.notFound("User not found");
      }

      return ResponseHelper.success({ unbanned: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /moderation/check-text - Manual toxicity check (admin tool)
   */
  @Put("/check-text", [authMiddleware])
  async checkText(req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await req.json()) as any;
      const text = body?.text;

      if (!text) {
        return ResponseHelper.error("Text is required");
      }

      const result = await ContentModeratorClient.checkToxicity(text);
      return ResponseHelper.success(result);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }
}
