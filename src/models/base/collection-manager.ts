import type { Collection, MongoClient } from "mongodb";
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
  }
}
