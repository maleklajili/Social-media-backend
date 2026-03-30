import type { Collection } from "mongodb";
import { BaseController } from "./base/base-controller";
import type { AiCv, AiCvSection } from "../models/ai-cv";
import { AiCvService } from "../services/ai-cv-service";
import { AiCvRepository } from "../repositories/ai-cv-repository";
import { userRepository } from "../repositories/user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import { Delete, Get, Post } from "../routes/router-manager";
import { authMiddleware } from "../middleware/aut-middleware";
import type { ServerRequest } from "../config/interfaces/i-request";
import { ResponseHelper } from "../utils/response-helper";

export class AiCvController extends BaseController<AiCv, AiCvService> {
  constructor() {
    super("/ai-cv");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<AiCv> {
    return CollectionsManager.aiCvCollection;
  }

  protected createService(): AiCvService {
    return new AiCvService(new AiCvRepository(), new userRepository());
  }

  @Post("/generate", [authMiddleware])
  async generateCv(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = await this.parseRequestBody<{
        language?: string;
        section?: AiCvSection;
        format?: string;
        customPrompt?: string;
      }>(req);

      return this.service.generateCv(
        req.user._id,
        body.language || "fr",
        body.section || "full",
        (body.format || "standard") as import("../models/ai-cv").AiCvFormat,
        body.customPrompt,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/reformulate/:id", [authMiddleware])
  async reformulateCv(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const { id } = req.params;
      if (!id || !this.isValidObjectId(id)) {
        return ResponseHelper.error("ID du CV invalide");
      }
      const body = await this.parseRequestBody<{
        instructions?: string;
      }>(req);

      const { ObjectId } = await import("mongodb");
      return this.service.reformulateCv(
        req.user._id,
        new ObjectId(id),
        body.instructions,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/my-cvs", [authMiddleware])
  async getMyCvs(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      return this.service.getUserCvs(req.user._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/download-pdf/:id", [authMiddleware])
  async downloadPdf(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const { id } = req.params;
      if (!id || !this.isValidObjectId(id)) {
        return ResponseHelper.error("ID du CV invalide");
      }
      const { ObjectId } = await import("mongodb");
      return this.service.downloadPdf(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete/:id", [authMiddleware])
  async deleteCv(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const { id } = req.params;
      if (!id || !this.isValidObjectId(id)) {
        return ResponseHelper.error("ID du CV invalide");
      }
      const { ObjectId } = await import("mongodb");
      return this.service.deleteCv(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
