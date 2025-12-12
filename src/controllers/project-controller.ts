import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Project } from "../models/project";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { ProjectRepository } from "../repositories/project-repository";
import { CertificationRepository } from "../repositories/certification-repository";
import { ProjectServices } from "../services/project-services";
import { userRepository } from "../repositories/user-repository";

export class ProjectController extends BaseController<
  Project,
  ProjectServices
> {
  constructor() {
    super("/projects");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Project> {
    return CollectionsManager.projectCollection;
  }

  protected createService(): ProjectServices {
    return new ProjectServices(
      new ProjectRepository(),
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

  @Post("/add-project", [authMiddleware])
  async addProject(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Project>(formData);

      return this.service.addProject(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-project/:id", [authMiddleware])
  async updateProject(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID de projet invalide ou manquant");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Project>(formData);

      return this.service.updateProject(
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
  async deleteProject(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("ID de projet invalide ou manquant");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      return this.service.deleteProjectWithFiles(
        req.user._id,
        new ObjectId(id),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/user/:userId", [authMiddleware])
  async getProjectsByUserId(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("ID utilisateur invalide ou manquant");
      }

      const projects = await this.service.getProjectsByUserId(
        new ObjectId(userId),
      );
      return ResponseHelper.success(projects);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
