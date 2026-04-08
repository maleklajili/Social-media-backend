import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import { Get, Put, Post, Delete } from "../routes/router-manager";
import path from "path";
import { promises as fs } from "fs";
import { UPLOAD_PATHS } from "../config/config";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { User } from "../models/user";
import { ObjectId } from "mongodb";
import type { ProfessionalUser } from "../models/user/professional-user";

import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ChangePasswordPayload } from "../interfaces/base/i-crud-controller";
import { CompanyRepository } from "../repositories/company-repository";
import type { Collection } from "mongodb";
import { userRepository } from "../repositories/user-repository";
import { UserService } from "../services/user-service";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";

class UserController extends BaseController<User, UserService> {
  protected createService(): UserService {
    return new UserService(new userRepository(), new CompanyRepository());
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
  // user-controller.ts
  @Delete("/:id", [authMiddleware])
  async deleteUser(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.params?.id;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }
      return this.service.delete(new ObjectId(userId));
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
      const userId = req.params?.id;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }
      // Appeler le service avec l'ID de l'URL
      return this.service.findUserById(new ObjectId(userId));
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

  // controllers/user-controller.ts

  // controllers/user-controller.ts

  @Get("/followers/:userId?", [authMiddleware])
  async getFollowers(req: ServerRequest): Promise<Response> {
    try {
      const userIdFromParams = req.params?.["userId?"];
      const targetUserId = userIdFromParams || req.user?._id?.toString();
      const currentUserId = req.user?._id;

      if (!targetUserId) {
        return ResponseHelper.error("User ID is required", 400);
      }

      return this.service.getFollowers(targetUserId, currentUserId);
    } catch (err) {
      console.error(" Error in getFollowers:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // controllers/user-controller.ts

  @Get("/following/:userId?", [authMiddleware])
  async getFollowing(req: ServerRequest): Promise<Response> {
    try {
      const userIdFromParams = req.params?.["userId?"];

      const targetUserId = userIdFromParams || req.user?._id?.toString();
      const currentUserId = req.user?._id;

      if (!targetUserId) {
        return ResponseHelper.error("User ID is required", 400);
      }

      return this.service.getFollowing(targetUserId, currentUserId);
    } catch (err) {
      console.error(" Error in getFollowing:", err);
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
      console.error(" Error in getFriends:", err);
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

      const pagination = req.pagination;
      const url = new URL(req.url);
      const search = url.searchParams.get("search") || "";

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
      console.error(" Error in getFriendSuggestions:", err);
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
      console.error("Error in searchFriends:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/cv/:userId?", [authMiddleware])
  async getCV(req: ServerRequest): Promise<Response> {
    try {
      // Si un userId est fourni dans l'URL, on l'utilise, sinon on prend l'utilisateur connecté
      const targetUserId = req.params?.userId || req.user?._id;
      if (!targetUserId) {
        return ResponseHelper.error("Identifiant utilisateur requis", 400);
      }

      // Convertir en ObjectId
      let targetId: ObjectId;
      try {
        targetId = new ObjectId(targetUserId);
      } catch {
        return ResponseHelper.error("Format d'ID invalide", 400);
      }

      // Récupérer l'utilisateur cible
      const user = await this.service["userRepository"].findById(targetId, 0);
      if (!user) {
        return ResponseHelper.error("Utilisateur non trouvé", 404);
      }

      // Vérifier que l'utilisateur a un CV (en le castant en ProfessionalUser)
      const professionalUser = user as ProfessionalUser;
      if (!professionalUser.cv) {
        return ResponseHelper.error("CV non trouvé pour cet utilisateur", 404);
      }

      // Construire le chemin du fichier (identique à l'upload)
      const docStorePath = `${UPLOAD_PATHS.documents}-${targetId.toString()}`;
      const filePath = path.join(
        process.cwd(),
        docStorePath,
        professionalUser.cv,
      );

      // Vérifier que le fichier existe
      try {
        await fs.access(filePath);
      } catch {
        return ResponseHelper.error("Fichier introuvable sur le disque", 404);
      }

      const fileBuffer = await fs.readFile(filePath);
      const fileName = professionalUser.cv;

      const ext = path.extname(fileName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } catch (err) {
      console.error("Erreur lors de la récupération du CV :", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  /**
   * GET /user/:userId/stats
   * Récupérer les statistiques d'un utilisateur
   */
  @Get("/:userId/stats", [authMiddleware])
  async getUserStats(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.params?.userId;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      return this.service.getUserStats(new ObjectId(userId));
    } catch (err) {
      console.error("Error in getUserStats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}

export default UserController;
