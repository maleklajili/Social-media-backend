import { Collection, ObjectId } from "mongodb";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Community } from "../models/community";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { CommunityServices } from "../services/community-services";
import { CommunityRepository } from "../repositories/community-repository";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";

export class CommunityController extends BaseController<
  Community,
  CommunityServices
> {
  constructor() {
    super("/community");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Community> {
    return CollectionsManager.communityCollection;
  }

  protected createService(): CommunityServices {
    return new CommunityServices(new CommunityRepository());
  }
  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      // Filtrer par userId de l'utilisateur connecté
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const filter = { createdBy: req.user._id };
      return super.getAll(req, undefined, filter);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/popular", [])
  async getPopularCommunities(req: ServerRequest): Promise<Response> {
    try {
      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 10;
      return this.service.getPopularCommunities(limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/search", [])
  async searchCommunities(req: ServerRequest): Promise<Response> {
    try {
      const query = req.query?.q as string;
      if (!query) {
        return ResponseHelper.error("Search query is required");
      }
      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 10;
      return this.service.searchCommunities(query, limit);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:name", [])
  async getCommunityDetails(req: ServerRequest): Promise<Response> {
    try {
      const { name } = req.params;
      if (!name) {
        return ResponseHelper.error("Community name is required");
      }
      return this.service.getCommunityDetails(name);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/create", [authMiddleware])
  async createCommunity(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Partial<Community>>(formData);
      return this.service.createCommunity(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/:id", [authMiddleware])
  async updateCommunity(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing community id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Partial<Community>>(formData);
      return this.service.updateCommunity(
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
  async deleteCommunity(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing community id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.deleteCommunity(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/:id/join", [authMiddleware])
  async joinCommunity(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing community id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.joinCommunity(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/:id/leave", [authMiddleware])
  async leaveCommunity(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing community id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.leaveCommunity(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
