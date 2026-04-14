import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Post } from "../models/post";
import { Delete, Get, Post as PostMethod, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { userRepository } from "../repositories/user-repository";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";
import { PostRepository } from "../repositories/post/post-repository";
import { PostServices } from "../services/post/post-services";
import { CommentRepository } from "../repositories/comment/comment-repository";
import { CommunityRepository } from "../repositories/community-repository";

export class PostController extends BaseController<Post, PostServices> {
  constructor() {
    super("/posts");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Post> {
    return CollectionsManager.postCollection;
  }

  protected createService(): PostServices {
    return new PostServices(
      new PostRepository(),
      new userRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
      new CommentRepository(),
      new CommunityRepository(),
    );
  }

  @Get("/feed", [authMiddleware, paginationMiddleware])
  async getFeed(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filter = (req.query.filter as string) || "popular";

      return this.service.getFeed(req.user._id, page, limit, filter);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/stats", [authMiddleware])
  async getPostStats(_req: ServerRequest): Promise<Response> {
    return this.service.getStats();
  }
  @PostMethod("/create", [authMiddleware])
  async createPost(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Post>(formData);

      return this.service.createPost(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:id", [authMiddleware])
  async getPost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      return this.service.getPostById(new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/:id", [authMiddleware])
  async updatePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Post>(formData);

      return this.service.updatePost(
        req.user._id,
        new ObjectId(id),
        body,
        formData,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:id", [authMiddleware])
  async deletePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return this.service.deletePost(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/community/:communityId", [authMiddleware])
  async getPostsByCommunity(req: RequestWithPagination): Promise<Response> {
    try {
      const { communityId } = req.params;

      if (!communityId || !ObjectId.isValid(communityId)) {
        return ResponseHelper.error("Invalid or missing community ID");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sort =
        (req.query.sort as "recent" | "popular" | "trending") || "recent";

      return this.service.getPostsByCommunity(
        new ObjectId(communityId),
        page,
        limit,
        sort,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @PostMethod("/:id/vote", [authMiddleware])
  async votePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { vote } = (await req.json()) as { vote: string };
      if (vote !== "up" && vote !== "down" && vote !== null) {
        return ResponseHelper.error("Invalid vote value");
      }

      return this.service.votePost(req.user._id, new ObjectId(id), vote);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:id/comments", [authMiddleware])
  async getComments(req: RequestWithPagination): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid post ID");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sort = (req.query.sort as "recent" | "popular") || "recent";

      return this.service.getPostComments(new ObjectId(id), page, limit, sort);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @PostMethod("/:id/comments", [authMiddleware])
  async createComment(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { content, parentCommentId } = (await req.json()) as {
        content: string;
        parentCommentId?: string;
      };

      if (!content || typeof content !== "string") {
        return ResponseHelper.error("Comment content is required");
      }

      const parentId =
        parentCommentId && ObjectId.isValid(parentCommentId)
          ? new ObjectId(parentCommentId)
          : undefined;

      return this.service.commentPost(
        req.user._id,
        new ObjectId(id),
        content,
        parentId,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/comments/:commentId/replies", [authMiddleware])
  async getCommentReplies(req: ServerRequest): Promise<Response> {
    try {
      const { commentId } = req.params;
      if (!commentId || !ObjectId.isValid(commentId)) {
        return ResponseHelper.error("Invalid comment ID");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      return this.service.getCommentReplies(
        new ObjectId(commentId),
        page,
        limit,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @PostMethod("/comments/:commentId/vote", [authMiddleware])
  async voteComment(req: ServerRequest): Promise<Response> {
    try {
      const { commentId } = req.params;
      if (!commentId || !ObjectId.isValid(commentId)) {
        return ResponseHelper.error("Invalid comment ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { vote } = (await req.json()) as { vote: "up" | "down" };
      if (vote !== "up" && vote !== "down") {
        return ResponseHelper.error("Invalid vote value");
      }

      return this.service.voteComment(
        req.user._id,
        new ObjectId(commentId),
        vote,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/comments/:commentId", [authMiddleware])
  async updateComment(req: ServerRequest): Promise<Response> {
    try {
      const { commentId } = req.params;
      if (!commentId || !ObjectId.isValid(commentId)) {
        return ResponseHelper.error("Invalid comment ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { content } = (await req.json()) as { content: string };
      if (!content || typeof content !== "string") {
        return ResponseHelper.error("Comment content is required");
      }

      return this.service.updateComment(
        req.user._id,
        new ObjectId(commentId),
        content,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/comments/:commentId", [authMiddleware])
  async deleteComment(req: ServerRequest): Promise<Response> {
    try {
      const { commentId } = req.params;
      if (!commentId || !ObjectId.isValid(commentId)) {
        return ResponseHelper.error("Invalid comment ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return this.service.deleteComment(req.user._id, new ObjectId(commentId));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @PostMethod("/:id/save", [authMiddleware])
  async savePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return this.service.savePost(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:id/save", [authMiddleware])
  async unsavePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return this.service.unsavePost(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/trending", [authMiddleware])
  async getTrendingPosts(req: ServerRequest): Promise<Response> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      return this.service.getTrendingPosts(limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/user/:userId", [authMiddleware])
  async getPostsByUser(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("ID utilisateur invalide");
      }
      return this.service.getPostsByUserId(new ObjectId(userId));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @PostMethod("/:id/share", [authMiddleware])
  async sharePost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      // Check if there's a request body
      let avis: string | undefined;

      try {
        // Try to parse JSON body if it exists
        const text = await req.text();
        if (text && text.trim()) {
          const body = JSON.parse(text);
          avis = body.avis;
        }
      } catch (parseErr) {
        // If body is empty or invalid, just proceed with undefined content
        console.log(
          "No valid JSON body, proceeding with share without avis",
          parseErr,
        );
      }

      return this.service.sharePost(req.user._id, new ObjectId(id), avis);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/shared", [authMiddleware, paginationMiddleware])
  async getSharedPosts(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      return this.service.getSharedPosts(req.user._id, page, limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:id/shares", [authMiddleware])
  async getPostShares(req: RequestWithPagination): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      return this.service.getPostShares(new ObjectId(id), page, limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
