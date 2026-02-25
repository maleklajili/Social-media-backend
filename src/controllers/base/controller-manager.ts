import AuthController from "../auth-controller";
import { CommunityController } from "../community-controller";
import { CompanyController } from "../company-controller";
import { EducationController } from "../education-controller";
import { ExperienceController } from "../experience-controller";
import { JobController } from "../job-controller";
import { MessageController } from "../message/message-controller";
import { PostController } from "../post-controller";
import { ProfileController } from "../profile-controller";
import { ProjectController } from "../project-controller";
import { SkillController } from "../skill-controller";
import { LanguageController } from "../skills/language-controller";
import { PersonalSkillController } from "../skills/personal-skill-controller";
import { TechnicalSkillController } from "../skills/technical-skill-controller";
import { TransactionController } from "../transaction-controller";
import UserController from "../user-controller";

export class ControllerManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getAllControllers(): Array<new () => any> {
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
      ProfileController,
      TransactionController,
      CompanyController,
      JobController,
      CommunityController,
      MessageController,
    ];
  }
}
