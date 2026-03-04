import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../../config/interfaces/i-pagination";
import type { ServerRequest } from "../../config/interfaces/i-request";
import { paginationMiddleware } from "../../middleware/pagination-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Language } from "../../models/skills/language";
import { Delete, Get, Post, Put } from "../../routes/router-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { BaseController } from "../base/base-controller";
import { LanguageRepository } from "../../repositories/skills/language-repository";
import { LanguageService } from "../../services/skills/language-service";
import { authMiddleware } from "../../middleware/aut-middleware";
import { userRepository } from "../../repositories/user-repository";
import { TransactionService } from "../../services/transaction-services";
import { TransactionRepository } from "../../repositories/transaction-repository";

export class LanguageController extends BaseController<
  Language,
  LanguageService
> {
  constructor() {
    super("/languages");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Language> {
    return CollectionsManager.languageCollection;
  }

  protected createService(): LanguageService {
    return new LanguageService(
      new LanguageRepository(),
      new userRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
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

  @Post("/add-language", [authMiddleware])
  async addLanguage(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = (await req.json()) as Partial<Language>;
      return this.service.addLanguage(req.user._id, body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-language/:id", [authMiddleware])
  async updateLanguage(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = (await req.json()) as Partial<Language>;
      return this.service.updateLanguage(req.user._id, new ObjectId(id), body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete-language/:id", [authMiddleware])
  async deleteLanguage(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      return this.service.deleteLanguage(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/get-language/:id", [authMiddleware])
  async getLanguageById(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID invalide");
      }
      return this.service.getLanguageById(new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/user/:userId", [authMiddleware])
  async getLanguagesByUser(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("ID utilisateur invalide");
      }
      return this.service.getLanguagesByUser(new ObjectId(userId));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
