import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface Job extends BaseModel {
  userId: ObjectId;
  companyId: ObjectId;
  title: string;
  description: string;
  location: string;
  contractType: "CDI" | "CDD" | "Stage" | "Alternance" | "Freelance";
  experience: "Débutant" | "1-3 ans" | "3-5 ans" | "5+ ans";
  salaryMin?: number;
  salaryMax?: number;
  remotePolicy: "Sur site" | "Hybride" | "Full Remote";
  skills: string[];
  status: "active" | "draft" | "closed" | "expired";
  isFeatured: boolean;
  views: number;
  applications: number;
  publishedAt?: Date;
  expiresAt?: Date;
}
