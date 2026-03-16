// controllers/friend-group-controller.ts
import { ObjectId } from "mongodb";
import { authMiddleware } from "../middleware/aut-middleware";
import { Get, Post, Put, Delete } from "../routes/router-manager";
import type { ServerRequest } from "../config/interfaces/i-request";
import { FriendGroupServices } from "../services/friend-group-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { CollectionsManager } from "../models/base/collection-manager";
import { Collection } from "mongodb";
import type { FriendGroup } from "../models/friend-group";

interface CreateFriendGroupPayload {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface UpdateFriendGroupPayload {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface AddMembersPayload {
  memberIds: string[];
}

export class FriendGroupController extends BaseController<
  FriendGroup,
  FriendGroupServices
> {
  constructor() {
    super("/friend-groups");
    this.initializeService(new FriendGroupServices());
  }

  protected initializeCollection(): Collection<FriendGroup> {
    return CollectionsManager.friendGroupCollection;
  }

  protected createService(): FriendGroupServices {
    return new FriendGroupServices();
  }

  @Post("/create", [authMiddleware])
  async createFriendGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const body = await this.parseRequestBody<CreateFriendGroupPayload>(req);

      if (!body.name) {
        return ResponseHelper.error("Group name is required", 400);
      }

      return this.service.createFriendGroup(
        userId,
        body.name,
        body.description,
        body.icon,
        body.color,
      );
    } catch (err) {
      console.error("❌ Error creating friend group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/", [authMiddleware])
  async getUserFriendGroups(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      return this.service.getUserFriendGroups(userId);
    } catch (err) {
      console.error("❌ Error fetching user friend groups:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:groupId", [authMiddleware])
  async getFriendGroupById(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      return this.service.getFriendGroupById(new ObjectId(groupId), userId);
    } catch (err) {
      console.error("❌ Error fetching friend group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/:groupId", [authMiddleware])
  async updateFriendGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      const body = await this.parseRequestBody<UpdateFriendGroupPayload>(req);

      return this.service.updateFriendGroup(
        new ObjectId(groupId),
        userId,
        body,
      );
    } catch (err) {
      console.error("❌ Error updating friend group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:groupId", [authMiddleware])
  async deleteFriendGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      return this.service.deleteFriendGroup(new ObjectId(groupId), userId);
    } catch (err) {
      console.error("❌ Error deleting friend group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/:groupId/add-member/:memberId", [authMiddleware])
  async addMemberToGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;
      const memberId = req.params?.memberId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      if (!memberId || !ObjectId.isValid(memberId)) {
        return ResponseHelper.error("Invalid member ID format", 400);
      }

      return this.service.addMemberToGroup(
        new ObjectId(groupId),
        userId,
        new ObjectId(memberId),
      );
    } catch (err) {
      console.error("❌ Error adding member to group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:groupId/remove-member/:memberId", [authMiddleware])
  async removeMemberFromGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;
      const memberId = req.params?.memberId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      if (!memberId || !ObjectId.isValid(memberId)) {
        return ResponseHelper.error("Invalid member ID format", 400);
      }

      return this.service.removeMemberFromGroup(
        new ObjectId(groupId),
        userId,
        new ObjectId(memberId),
      );
    } catch (err) {
      console.error("❌ Error removing member from group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/:groupId/add-members", [authMiddleware])
  async addMembersToGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      const body = await this.parseRequestBody<AddMembersPayload>(req);

      if (!Array.isArray(body.memberIds) || body.memberIds.length === 0) {
        return ResponseHelper.error("Invalid member IDs format", 400);
      }

      const memberIds = body.memberIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      if (memberIds.length === 0) {
        return ResponseHelper.error("No valid member IDs provided", 400);
      }

      return this.service.addMembersToGroup(
        new ObjectId(groupId),
        userId,
        memberIds,
      );
    } catch (err) {
      console.error("❌ Error adding members to group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:groupId/remove-members", [authMiddleware])
  async removeMembersFromGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params?.groupId;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("Invalid group ID format", 400);
      }

      const body = await this.parseRequestBody<AddMembersPayload>(req);

      if (!Array.isArray(body.memberIds) || body.memberIds.length === 0) {
        return ResponseHelper.error("Invalid member IDs format", 400);
      }

      const memberIds = body.memberIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      if (memberIds.length === 0) {
        return ResponseHelper.error("No valid member IDs provided", 400);
      }

      return this.service.removeMembersFromGroup(
        new ObjectId(groupId),
        userId,
        memberIds,
      );
    } catch (err) {
      console.error("❌ Error removing members from group:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/search/:query", [authMiddleware])
  async searchFriendGroups(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const query = req.params?.query;

      if (!userId) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      if (!query) {
        return ResponseHelper.error("Search query is required", 400);
      }

      return this.service.searchFriendGroups(userId, query);
    } catch (err) {
      console.error("❌ Error searching friend groups:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}

export const friendGroupController = new FriendGroupController();
