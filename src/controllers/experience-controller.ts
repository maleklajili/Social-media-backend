import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Experience } from "../models/experience";
import { CertificationRepository } from "../repositories/certification-repository";
import { ExperienceRepository } from "../repositories/experience-repository";
import { Delete, Get, Post } from "../routes/router-manager";
import { ExperienceServices } from "../services/experience-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";

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
      return super.getAll(req, undefined, filter);
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
  @Delete("/delete-experience/:id", [authMiddleware])
  async deleteExperience(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return ResponseHelper.error("Experience ID is required");
      }
      await this.service.deleteById(new ObjectId(id));
      return ResponseHelper.success({
        message: "Experience deleted successfully",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
