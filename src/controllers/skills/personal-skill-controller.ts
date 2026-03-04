import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../../config/interfaces/i-pagination";
import type { ServerRequest } from "../../config/interfaces/i-request";
import { paginationMiddleware } from "../../middleware/pagination-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { PersonalSkill } from "../../models/skills/personal-skill";
import { Delete, Get, Post, Put } from "../../routes/router-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { BaseController } from "../base/base-controller";
import { PersonalSkillRepository } from "../../repositories/skills/personal-skill-repository";
import { PersonalSkillService } from "../../services/skills/personal-skill-service";
import { authMiddleware } from "../../middleware/aut-middleware";

export class PersonalSkillController extends BaseController<
  PersonalSkill,
  PersonalSkillService
> {
  constructor() {
    super("/personal-skills");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<PersonalSkill> {
    return CollectionsManager.personalSkillCollection;
  }

  protected createService(): PersonalSkillService {
    return new PersonalSkillService(new PersonalSkillRepository());
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const filter = { userId: req.user._id };
      return super.getAll(req, undefined, filter);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/add-personal-skill", [authMiddleware])
  async addPersonalSkill(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = (await req.json()) as Partial<PersonalSkill>;
      return this.service.addPersonalSkill(req.user._id, body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-personal-skill/:id", [authMiddleware])
  async updatePersonalSkill(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = (await req.json()) as Partial<PersonalSkill>;
      return this.service.updatePersonalSkill(
        req.user._id,
        new ObjectId(id),
        body,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete-personal-skill/:id", [authMiddleware])
  async deletePersonalSkill(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      return this.service.deletePersonalSkill(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/get-personal-skill/:id", [authMiddleware])
  async getPersonalSkillById(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      return this.service.getPersonalSkillById(new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  // PersonalSkillController.ts

  @Get("/user/:userId", [authMiddleware]) // protect with auth if needed
  async getPersonalSkillsByUser(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }
      if (!ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format");
      }

      // Directly return the Response from the service
      return this.service.getPersonalSkillsByUser(new ObjectId(userId));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
