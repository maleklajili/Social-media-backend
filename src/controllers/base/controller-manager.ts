import AuthController from "../auth-controller";
import { EducationController } from "../education-controller";
import { ExperienceController } from "../experience-controller";
import PostController from "../post-controller";
import { ProjectController } from "../project-controller";
import { SkillController } from "../skill-controller";
import { LanguageController } from "../skills/language-controller";
import { PersonalSkillController } from "../skills/personal-skill-controller";
import { TechnicalSkillController } from "../skills/technical-skill-controller";
import UserController from "../user-controller";

export class ControllerManager {
  static getAllControllers() {
    return [
      UserController,
      PostController,
      AuthController,
      SkillController,
      ExperienceController,
      EducationController,
      ProjectController,
      TechnicalSkillController,
      PersonalSkillController,
      LanguageController,
    ];
  }
}
