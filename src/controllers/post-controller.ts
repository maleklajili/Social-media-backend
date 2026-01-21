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
      if (vote !== "up" && vote !== "down") {
        return ResponseHelper.error("Invalid vote value");
      }

      return this.service.votePost(req.user._id, new ObjectId(id), vote);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @PostMethod("/:id/comment", [authMiddleware])
  async commentPost(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing post ID");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const { content } = (await req.json()) as { content: string };
      if (!content || typeof content !== "string") {
        return ResponseHelper.error("Comment content is required");
      }

      return this.service.commentPost(req.user._id, new ObjectId(id), content);
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

  /*  @Get("/user/:userId", [authMiddleware])
  async getUserPosts(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid or missing user ID");
      }

      const posts = await this.service.getPostsByUserId(new ObjectId(userId));
      return ResponseHelper.success(posts);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  } */

  /*   @Get("/community/:community", [authMiddleware])
  async getCommunityPosts(req: ServerRequest): Promise<Response> {
    try {
      const { community } = req.params;
      if (!community) {
        return ResponseHelper.error("Community name is required");
      }

      const posts = await this.service.getPostsByCommunity(community);
      return ResponseHelper.success(posts);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  } */
}
