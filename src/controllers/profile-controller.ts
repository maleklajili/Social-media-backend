// src/controllers/profile-controller.ts
import { Get } from "../routes/router-manager";
import { authMiddleware } from "../middleware/aut-middleware";
import { ResponseHelper } from "../utils/response-helper";
import type { ServerRequest } from "../config/interfaces/i-request";
import { ProfileService } from "../services/profile-service";
import { userRepository } from "../repositories/user-repository";
import { LanguageRepository } from "../repositories/skills/language-repository";
import { ExperienceRepository } from "../repositories/experience-repository";
import { EducationRepository } from "../repositories/education-repository";
import { ProjectRepository } from "../repositories/project-repository";
import { TechnicalSkillRepository } from "../repositories/skills/technical-skill-repository";
import { PersonalSkillRepository } from "../repositories/skills/personal-skill-repository";
import { ObjectId } from "mongodb";

export class ProfileController {
  private profileService: ProfileService;

  constructor() {
    this.profileService = new ProfileService(
      new userRepository(),
      new LanguageRepository(),
      new ExperienceRepository(),
      new EducationRepository(),
      new ProjectRepository(),
      new TechnicalSkillRepository(),
      new PersonalSkillRepository(),
    );
  }

  @Get("/profile", [authMiddleware])
  async getProfile(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      return this.profileService.getUserProfile(req.user._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/profile/:userId", [authMiddleware])
  async getUserProfileById(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;

      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      // Note: You might want to add authorization logic here
      // to check if the current user can view this profile

      const userObjectId = new ObjectId(userId);
      return this.profileService.getUserProfile(userObjectId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
