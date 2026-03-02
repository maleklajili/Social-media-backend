import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import { Get, Put, Post, Delete } from "../routes/router-manager";

import type { ServerRequest } from "../config/interfaces/i-request";
import type { User } from "../models/user";
import { ObjectId } from "mongodb";

import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ChangePasswordPayload } from "../interfaces/base/i-crud-controller";

import type { Collection } from "mongodb";
import { userRepository } from "../repositories/user-repository";
import { UserService } from "../services/user-service";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";

class UserController extends BaseController<User, UserService> {
  protected createService(): UserService {
    return new UserService(new userRepository());
  }

  constructor() {
    super("/user");
    this.initializeService(this.createService());
  }
  protected initializeCollection(): Collection<User> {
    return CollectionsManager.userCollection;
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      return super.getAll(req);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/current-user", [authMiddleware])
  async getCurrentUser(req: ServerRequest): Promise<Response> {
    try {
      return this.service.findUserById(req.user?._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/by-id/:id", [authMiddleware])
  async getUserById(req: ServerRequest): Promise<Response> {
    try {
      return this.service.findUserById(req.user?._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/change-password", [authMiddleware])
  async changePassword(req: ServerRequest): Promise<Response> {
    try {
      const body = await this.parseRequestBody<ChangePasswordPayload>(req);
      return this.service.changePassword(req.user?._id, body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-profile", [authMiddleware])
  async updateProfile(req: ServerRequest): Promise<Response> {
    try {
      const formData = (await req.formData()) as unknown as FormData;
      const body = await this.parseFormData<User>(formData);
      return this.service.updateProfile(req, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Post("/follow/:userId", [authMiddleware])
  async followUser(req: ServerRequest): Promise<Response> {
    try {
      const targetUserId = req.params?.userId;
      const currentUserId = req.user?._id;

      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.followUser(currentUserId, targetUserId!);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/unfollow/:userId", [authMiddleware])
  async unfollowUser(req: ServerRequest): Promise<Response> {
    try {
      const targetUserId = req.params?.userId;
      const currentUserId = req.user?._id;

      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.unfollowUser(currentUserId, targetUserId!);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/followers/:userId?", [authMiddleware])
  async getFollowers(req: ServerRequest): Promise<Response> {
    try {
      // If userId is provided, get followers of that user, otherwise get followers of current user
      const targetUserId = req.params?.userId || req.user?._id?.toString();
      const currentUserId = req.user?._id;

      if (!targetUserId) {
        return ResponseHelper.error("User ID is required", 400);
      }

      return this.service.getFollowers(targetUserId, currentUserId);
    } catch (err) {
      console.error("❌ Error in getFollowers:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/following/:userId?", [authMiddleware])
  async getFollowing(req: ServerRequest): Promise<Response> {
    try {
      // If userId is provided, get following of that user, otherwise get following of current user
      const targetUserId = req.params?.userId || req.user?._id?.toString();
      const currentUserId = req.user?._id;

      if (!targetUserId) {
        return ResponseHelper.error("User ID is required", 400);
      }

      return this.service.getFollowing(targetUserId, currentUserId);
    } catch (err) {
      console.error("❌ Error in getFollowing:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/follow-status/:userId", [authMiddleware])
  async getFollowStatus(req: ServerRequest): Promise<Response> {
    try {
      const targetUserId = req.params?.userId;
      const currentUserId = req.user?._id;

      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!targetUserId) {
        return ResponseHelper.error("Target user ID is required", 400);
      }

      return this.service.getFollowStatus(currentUserId, targetUserId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/friends", [authMiddleware])
  async getFriends(req: ServerRequest): Promise<Response> {
    try {
      const currentUserId = req.user?._id;

      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.getFriends(currentUserId);
    } catch (err) {
      console.error("❌ Error in getFriends:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/friends/suggestions", [authMiddleware, paginationMiddleware])
  async getFriendSuggestions(req: RequestWithPagination): Promise<Response> {
    try {
      const currentUserId = req.user?._id;
      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const pagination = req.pagination; // { skip, take }
      const url = new URL(req.url);
      const search = url.searchParams.get("search") || ""; // si besoin plus tard

      const result = await this.service.getFriendSuggestions(
        currentUserId,
        pagination?.skip,
        pagination?.take,
        search,
      );

      return ResponseHelper.success({
        suggestions: result.data,
        total: result.total,
        currentPage:
          Math.floor((pagination?.skip || 0) / (pagination?.take || 10)) + 1,
        totalPages: Math.ceil(result.total / (pagination?.take || 10)),
      });
    } catch (err) {
      console.error("❌ Error in getFriendSuggestions:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/mutual-friends/:userId", [authMiddleware])
  async getMutualFriends(req: ServerRequest): Promise<Response> {
    try {
      const currentUserId = req.user?._id;
      const targetUserId = req.params?.userId;
      if (!currentUserId || !targetUserId) {
        return ResponseHelper.error("Missing user id", 400);
      }
      if (!ObjectId.isValid(targetUserId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }
      return this.service.getMutualFriendsList(
        currentUserId,
        new ObjectId(targetUserId),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/friends/search", [authMiddleware])
  async searchFriends(req: ServerRequest): Promise<Response> {
    try {
      const currentUserId = req.user?._id;

      if (!currentUserId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      // Get search query from URL params
      const url = new URL(req.url);
      const query = url.searchParams.get("q");

      if (!query) {
        return ResponseHelper.error("Search query is required", 400);
      }

      return this.service.searchFriends(currentUserId, query);
    } catch (err) {
      console.error("❌ Error in searchFriends:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}

export default UserController;
