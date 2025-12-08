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
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      // Populate skills avec _id, name et category
      return super.getAll(req, [
        {
          from: "skills",
          localField: "skills",
          foreignField: "_id",
          as: "skills",
          select: ["_id", "name", "category"],
          unwind: false,
        },
      ]);
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

      // Parser skills si envoyé en string JSON
      if (formData.has("skills")) {
        try {
          const skillsRaw = formData.get("skills") as string;
          // Si le frontend envoie ["id1","id2"]
          const skillIds = JSON.parse(skillsRaw);
          if (Array.isArray(skillIds)) {
            body.skills = skillIds.map((id: string) => new ObjectId(id));
          } else {
            body.skills = [];
          }
          body.userId = new ObjectId(req.user._id);
        } catch {
          console.error("Error parsing skills");
          body.skills = [];
        }
      }

      return this.service.addEducation(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-education", [authMiddleware])
  async updateEducation(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Education>(formData);

      // Parser skills si envoyé en string JSON
      if (formData.has("skills")) {
        const skillsRaw = formData.get("skills") as string;
        try {
          body.skills = JSON.parse(skillsRaw).map(
            (id: string) => new ObjectId(id),
          );
        } catch (err) {
          return ResponseHelper.serverError(
            `Invalid skills format,${String(err)}`,
          );
        }
      }

      return this.service.updateEducation(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete/:id", [authMiddleware])
  async deleteEducation(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      // Vérification de l'id de l'éducation
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing education id");
      }
      // Vérification de l'utilisateur connecté
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const deleted = await this.service.deleteEducation(
        new ObjectId(id),
        req.user._id, // :coche_blanche: maintenant c'est sûr que _id existe
      );

      if (!deleted) {
        return ResponseHelper.notFound("Education not found or unauthorized");
      }
      return ResponseHelper.success({
        message: "Education deleted successfully",
      });
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
