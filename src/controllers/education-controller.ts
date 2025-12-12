import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Education } from "../models/education";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { EducationRepository } from "../repositories/education-repository";
import { CertificationRepository } from "../repositories/certification-repository";
import { EducationServices } from "../services/education-services";
import { userRepository } from "../repositories/user-repository";

export class EducationController extends BaseController<
  Education,
  EducationServices
> {
  constructor() {
    super("/education");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Education> {
    return CollectionsManager.educationCollection;
  }

  protected createService(): EducationServices {
    return new EducationServices(
      new EducationRepository(),
      new CertificationRepository(),
      new userRepository(),
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const filter: any = { userId: req.user._id };
      if (req.query?.type) {
        filter.type = req.query.type;
      }
      // Populate skills avec _id, name et category
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

  @Post("/add-education", [authMiddleware])
  async addEducation(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Education>(formData);
      return this.service.addEducation(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-education/:id", [authMiddleware])
  async updateEducation(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing education id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Education>(formData);
      return this.service.updateEducation(
        req.user._id,
        new ObjectId(id),
        body,
        formData,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete/:id", [authMiddleware])
  async deleteEducation(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing education id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      // Utiliser la nouvelle méthode qui supprime aussi les fichiers
      return this.service.deleteEducationWithFiles(
        req.user._id,
        new ObjectId(id),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/user/:userId", [authMiddleware])
  async getEducationsByUserId(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid or missing user id");
      }
      const educations = await this.service.getEducationsByUserId(
        new ObjectId(userId),
      );
      return ResponseHelper.success(educations);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
