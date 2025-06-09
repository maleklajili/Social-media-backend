import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Skill } from "../models/skill";
import { CertificationRepository } from "../repositories/certification-repository";

import { skillRepository } from "../repositories/skill-repository";
import { userRepository } from "../repositories/user-repository";
import { Get, Post, Put } from "../routes/router-manager";
import { SkillService } from "../services/skill-service";
import { ResponseHelper } from "../utils/response-helper";

import { BaseController } from "./base/base-controller";

export class SkillController extends BaseController<Skill, SkillService> {
  protected createService(): SkillService {
    return new SkillService(
      new skillRepository(),
      new userRepository(),
      new CertificationRepository(),
    );
  }

  constructor() {
    super("/skill");
    this.initializeService(this.createService());
  }
  protected initializeCollection(): Collection<Skill> {
    return CollectionsManager.skillCollection;
  }
  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      return super.getAll(req, [
        {
          from: "certifications",
          localField: "certifications",
          foreignField: "_id",
          as: "certifications",
          select: ["_id", "file", "name"],
          unwind: false,
        },
      ]);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Post("/add-skill", [authMiddleware])
  async addSkill(req: ServerRequest): Promise<Response> {
    try {
      const formData = (await req.formData()) as FormData;
      const certifNames: string[] = formData.getAll("certifNames").map(String);
      formData.delete("certifNames");
      const body = await this.parseFormData<Skill>(formData);
      return this.service.createOneSkill(body, formData, certifNames);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/add-many-skill", [authMiddleware])
  async addManySkill(req: ServerRequest): Promise<Response> {
    try {
      const formData = (await req.formData()) as FormData;
      const certifNamesList: string[][] = [];

      // Parse fields and build skills[]
      const body = await this.parseFormData<{ skills: Skill[] }>(formData);

      if (!req.user || !req.user._id || !ObjectId.isValid(req.user._id)) {
        return ResponseHelper.error("Invalid or missing user ID");
      }

      const userId = new ObjectId(req.user._id);
      const skillDocs: Skill[] = [];

      for (const skill of body.skills) {
        if (!skill) continue;

        skillDocs.push({
          // Identity
          userId,

          // Classification
          categorie: skill.categorie,
          sousCategorie: skill.sousCategorie,

          // Core Skill Details
          name: skill.name,
          level: skill.level,
          description: skill.description,
          color: skill.color,

          // Metrics
          experienceNumber: skill.experienceNumber,
          projectNumber: skill.projectNumber,
          percentage: skill.percentage,

          // Certifications
          certifications: [],
          certifed: skill.certifed,

          // Flags
          favorite: skill.favorite,
          apprenticeship: skill.apprenticeship,

          // Timestamps
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return this.service.createManySkills(
        skillDocs,
        formData,
        certifNamesList,
      );
    } catch (err) {
      return ResponseHelper.serverError(`Failed to add skills: ${String(err)}`);
    }
  }

  @Put("/update-many-skill")
  async updateMany(req: ServerRequest): Promise<Response> {
    try {
      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<{ skills: Skill[] }>(formData);
      const certifNamesList: string[][] = [];
      // Get userId from auth middleware
      if (!req.user || !req.user._id || !ObjectId.isValid(req.user._id)) {
        return ResponseHelper.error("Invalid or missing user ID");
      }
      const userId = new ObjectId(req.user._id);
      const skillDocs: Skill[] = [];
      for (const skill of body.skills) {
        if (!skill) {
          return ResponseHelper.error("invalid data");
        }

        skillDocs.push({
          _id: !skill._id ? new ObjectId() : new ObjectId(skill._id),
          // Identity
          userId,

          // Classification
          categorie: skill.categorie,
          sousCategorie: skill.sousCategorie,

          // Core Skill Details
          name: skill.name,
          level: skill.level,
          description: skill.description,
          color: skill.color,

          // Metrics
          experienceNumber: skill.experienceNumber,
          projectNumber: skill.projectNumber,
          percentage: skill.percentage,

          // Certifications
          certifications: [],
          certifed: skill.certifed,

          // Flags
          favorite: skill.favorite,
          apprenticeship: skill.apprenticeship,

          // Timestamps
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return this.service.updateManySkills(
        userId,
        skillDocs,
        formData,
        certifNamesList,
      );
    } catch (err) {
      return ResponseHelper.serverError(
        `Failed to updated skills: ${String(err)}`,
      );
    }
  }
}
