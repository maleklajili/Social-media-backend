import type { Collection } from "mongodb";
import { BaseController } from "./base/base-controller";
import type { ManualCv } from "../models/manual-cv";
import { ManualCvService } from "../services/manual-cv-service";
import { ManualCvRepository } from "../repositories/manual-cv-repository";
import { userRepository } from "../repositories/user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { authMiddleware } from "../middleware/aut-middleware";
import type { ServerRequest } from "../config/interfaces/i-request";
import { ResponseHelper } from "../utils/response-helper";

export class ManualCvController extends BaseController<
  ManualCv,
  ManualCvService
> {
  constructor() {
    super("/manual-cv");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<ManualCv> {
    return CollectionsManager.manualCvCollection;
  }

  protected createService(): ManualCvService {
    return new ManualCvService(new ManualCvRepository(), new userRepository());
  }

  @Post("/create", [authMiddleware])
  async createCv(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = await this.parseRequestBody<Record<string, unknown>>(req);
      return this.service.createCv(req.user._id, body);
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

  @Get("/get/:id", [authMiddleware])
  async getCvById(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const { id } = req.params;
      if (!id || !this.isValidObjectId(id)) {
        return ResponseHelper.error("ID du CV invalide");
      }
      const { ObjectId } = await import("mongodb");
      return this.service.getCvById(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update/:id", [authMiddleware])
  async updateCv(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const { id } = req.params;
      if (!id || !this.isValidObjectId(id)) {
        return ResponseHelper.error("ID du CV invalide");
      }
      const body = await this.parseRequestBody<Record<string, unknown>>(req);
      const { ObjectId } = await import("mongodb");
      return this.service.updateCv(req.user._id, new ObjectId(id), body);
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
      const url = new URL(req.url, "http://localhost");
      const primaryColor = url.searchParams.get("primaryColor") || undefined;
      const accentColor = url.searchParams.get("accentColor") || undefined;
      const fontFamily = url.searchParams.get("fontFamily") || undefined;
      const format = url.searchParams.get("format") || undefined;
      const lang = url.searchParams.get("lang") || undefined;
      return this.service.downloadPdf(
        req.user._id,
        new ObjectId(id),
        primaryColor,
        accentColor,
        fontFamily,
        format,
        lang,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/import-profile", [authMiddleware])
  async importFromProfile(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      const body = await this.parseRequestBody<{
        format?: string;
        language?: string;
      }>(req);
      return this.service.importFromProfile(
        req.user._id,
        (body.format ||
          "standard") as import("../models/manual-cv").ManualCvFormat,
        body.language || "fr",
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
