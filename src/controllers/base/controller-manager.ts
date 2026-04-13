import AuthController from "../auth-controller";
import { CommunityController } from "../community-controller";
import { CompanyController } from "../company-controller";
import { EducationController } from "../education-controller";
import { ExperienceController } from "../experience-controller";
import { JobController } from "../job-controller";
import { JobApplicationController } from "../job-application-controller";
import { MessageController } from "../message/message-controller";
import { ReviewController } from "../review/review-controller";

import { PostController } from "../post-controller";
import { ProfileController } from "../profile-controller";
import { ProjectController } from "../project-controller";
import { SkillController } from "../skill-controller";
import { LanguageController } from "../skills/language-controller";
import { PersonalSkillController } from "../skills/personal-skill-controller";
import { TechnicalSkillController } from "../skills/technical-skill-controller";
import { TransactionController } from "../transaction-controller";
import UserController from "../user-controller";
import { FriendGroupController } from "../friend-group-controller";
import { AiCvController } from "../ai-cv-controller";
import { ManualCvController } from "../manual-cv-controller";
import { JobMatchController } from "../job-match-controller";
import { NotificationController } from "../notification-controller";
import { ModerationController } from "../moderation-controller";
import { PaymentController } from "../payment-controller";
import AdminController from "../admin-controller";
import { SearchController } from "../search-controller";
import { ReportController } from "../report-controller";

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
      JobApplicationController,
      CommunityController,
      MessageController,
      ReviewController,
      FriendGroupController,
      AiCvController,
      ManualCvController,
      JobMatchController,
      NotificationController,
      ModerationController,
      PaymentController,
      AdminController,
      SearchController,
      ReportController,
    ];
  }
}
