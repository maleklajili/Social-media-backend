import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Experience } from "../models/experience";
import { CertificationRepository } from "../repositories/certification-repository";
import { ExperienceRepository } from "../repositories/experience-repository";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { ExperienceServices } from "../services/experience-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { userRepository } from "../repositories/user-repository";

export class ExperienceController extends BaseController<
  Experience,
  ExperienceServices
> {
  constructor() {
    super("/experience");
    this.initializeService(this.createService());
  }
  protected initializeCollection(): Collection<Experience> {
    return CollectionsManager.experienceCollection;
  }
  protected createService(): ExperienceServices {
    return new ExperienceServices(
      new ExperienceRepository(),
      new CertificationRepository(),
      new userRepository(),
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      // Filtrer par userId de l'utilisateur connecté
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const filter = { userId: req.user._id };
      return super.getAll(
        req,
        [
          {
            from: "certifications",
            localField: "certificates",
            foreignField: "_id",
            as: "certificates",
            select: ["_id", "file", "name", "userId"],
            unwind: false,
          },
        ],
        filter,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/add-experience", [authMiddleware, paginationMiddleware])
  async addExperience(req: ServerRequest): Promise<Response> {
    try {
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Experience>(formData);
      if (!req.user?._id) {
        return ResponseHelper.error("undfined current user");
      }
      return this.service.addExperience(req.user?._id, body, formData);
    } catch (err) {
      //error
      return ResponseHelper.serverError(String(err));
    }
  }
  @Put("/update-experience/:id", [authMiddleware])
  async updateExperience(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id) {
        return ResponseHelper.error("Experience ID is required");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Experience>(formData);

      // Utilisez l'ID des paramètres au lieu de celui du body
      return this.service.updateExperience(
        req.user._id,
        new ObjectId(id),
        body,
        formData,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Delete("/delete-experience/:id", [authMiddleware])
  async deleteExperience(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return ResponseHelper.error("Experience ID is required");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      // Utiliser la nouvelle méthode qui supprime aussi les fichiers
      return this.service.deleteExperienceWithFiles(
        req.user._id,
        new ObjectId(id),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
