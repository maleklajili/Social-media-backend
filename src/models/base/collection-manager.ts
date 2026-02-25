import { Collection, type MongoClient } from "mongodb";
import { EnvLoader } from "../../config/env";
import type { Certification } from "../certifications";
import type { EmailVerificationToken } from "../email-verification-token";
import type { Experience } from "../experience";
import type { SkillCategory } from "../global/skill-category";
import type { OtpVerification } from "../otp-verification";
import type { Post } from "../post";
import type { RefreshToken } from "../refresh-token";
import type { Skill } from "../skill";
import type { User } from "../user";
import type { UserStorage } from "../user-storage";
import type { Education } from "../education";
import type { Project } from "../project";
import type { PersonalSkill } from "../skills/personal-skill";
import type { Language } from "../skills/language";
import type { TechnicalSkill } from "../skills/technical-skill";
import type { Transaction } from "../transaction";
import type { Company } from "../company";
import type { Job } from "../job";
import type { Community } from "../community/community";
import type { CommunityMember } from "../community/community-member";
import type { Comment } from "../comment";
import type { Message } from "../messages/message";

export class CollectionsManager {
  static userCollection: Collection<User>;
  static postCollection: Collection<Post>;
  static refreshCollection: Collection<RefreshToken>;
  static otpCollection: Collection<OtpVerification>;
  static emailVerfificationTokenCollection: Collection<EmailVerificationToken>;
  static skillCollection: Collection<Skill>;
  static certificationCollection: Collection<Certification>;
  static userStrorageCollection: Collection<UserStorage>;
  static experienceCollection: Collection<Experience>;
  static skillCategorieCollection: Collection<SkillCategory>;
  static educationCollection: Collection<Education>;
  static projectCollection: Collection<Project>;
  static technicalSkillCollection: Collection<TechnicalSkill>;
  static personalSkillCollection: Collection<PersonalSkill>;
  static languageCollection: Collection<Language>;
  static transactionCollection: Collection<Transaction>;
  static companyCollection: Collection<Company>;
  static jobCollection: Collection<Job>;
  static communityCollection: Collection<Community>;
  static communityMemberCollection: Collection<CommunityMember>;
  static commentCollection: Collection<Comment>;
  static messageCollection: Collection<Message>;

  static initializeCollections(client: MongoClient) {
    const db = client.db(EnvLoader.databaseName);
    this.userCollection = db.collection<User>("users");
    this.postCollection = db.collection<Post>("posts");
    this.otpCollection = db.collection<OtpVerification>("otp-verifications");
    this.refreshCollection = db.collection<RefreshToken>("refresh-tokens");
    this.emailVerfificationTokenCollection =
      db.collection<EmailVerificationToken>("email-verification-tokens");
    this.skillCollection = db.collection<Skill>("skills");
    this.certificationCollection =
      db.collection<Certification>("certifications");
    this.userStrorageCollection = db.collection<UserStorage>("user-storage");
    this.experienceCollection = db.collection<Experience>("experiences");
    this.skillCategorieCollection =
      db.collection<SkillCategory>("skill-categories");
    this.educationCollection = db.collection<Education>("educations");
    this.projectCollection = db.collection<Project>("projects");
    this.technicalSkillCollection =
      db.collection<TechnicalSkill>("technical-skills");
    this.personalSkillCollection =
      db.collection<PersonalSkill>("personal-skills");
    this.languageCollection = db.collection<Language>("languages");
    this.transactionCollection = db.collection<Transaction>("transactions");
    this.companyCollection = db.collection<Company>("companies");
    this.jobCollection = db.collection<Job>("jobs");
    this.communityCollection = db.collection<Community>("communities");
    this.communityMemberCollection =
      db.collection<CommunityMember>("community-members");
    this.commentCollection = db.collection<Comment>("comments");
    this.messageCollection = db.collection<Message>("messages");
  }
}
