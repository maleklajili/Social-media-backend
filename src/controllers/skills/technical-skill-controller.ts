// src/controllers/skills/technical-skill-controller.ts
import { ObjectId } from "mongodb";
import type { RequestWithPagination } from "../../config/interfaces/i-pagination";
import type { ServerRequest } from "../../config/interfaces/i-request";
import { paginationMiddleware } from "../../middleware/pagination-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { TechnicalSkill } from "../../models/skills/technical-skill";
import { Delete, Get, Post, Put } from "../../routes/router-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { BaseController } from "../base/base-controller";
import { TechnicalSkillRepository } from "../../repositories/skills/technical-skill-repository";
import { TechnicalSkillService } from "../../services/skills/technical-skill-service";
import { userRepository } from "../../repositories/user-repository";
import { authMiddleware } from "../../middleware/aut-middleware";
import { TransactionService } from "../../services/transaction-services";
import { TransactionRepository } from "../../repositories/transaction-repository";

export class TechnicalSkillController extends BaseController<
  TechnicalSkill,
  TechnicalSkillService
> {
  constructor() {
    super("/technical-skills");
    this.initializeService(this.createService());
  }

  protected initializeCollection() {
    return CollectionsManager.technicalSkillCollection;
  }

  protected createService(): TechnicalSkillService {
    return new TechnicalSkillService(
      new TechnicalSkillRepository(),
      new userRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination) {
    if (!req.user?._id) {
      return ResponseHelper.error("Utilisateur non authentifié");
    }
    const filter = { userId: req.user._id };
    return super.getAll(req, undefined, filter);
  }

  @Post("/add-technical-skill", [authMiddleware])
  async add(req: ServerRequest) {
    if (!req.user?._id) {
      return ResponseHelper.error("Utilisateur non authentifié");
    }
    const body = (await req.json()) as Partial<TechnicalSkill>;
    return this.service.addTechnicalSkill(req.user._id, body);
  }

  @Put("/update-technical-skill/:id", [authMiddleware])
  async update(req: ServerRequest) {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
      return ResponseHelper.error("ID invalide");
    }
    if (!req.user?._id) {
      return ResponseHelper.error("Utilisateur non authentifié");
    }
    const body = (await req.json()) as Partial<TechnicalSkill>;
    return this.service.updateTechnicalSkill(
      req.user._id,
      new ObjectId(id),
      body,
    );
  }

  @Delete("/delete-technical-skill/:id", [authMiddleware])
  async delete(req: ServerRequest) {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
      return ResponseHelper.error("ID invalide");
    }
    if (!req.user?._id) {
      return ResponseHelper.error("Utilisateur non authentifié");
    }
    return this.service.deleteTechnicalSkill(req.user._id, new ObjectId(id));
  }

  @Get("/get-technical-skill/:id", [authMiddleware])
  async getTechnicalSkillById(req: ServerRequest) {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
      return ResponseHelper.error("ID invalide");
    }
    return this.service.getTechnicalSkillById(new ObjectId(id));
  }
  // Dans technical-skill-controller.ts
  @Get("/grouped-by-category", [authMiddleware])
  async getGroupedByCategory(req: ServerRequest) {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      return await this.service.getTechnicalSkillsGroupedByCategory(
        req.user._id,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
