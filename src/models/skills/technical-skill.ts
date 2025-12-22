import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface TechnicalSkill extends BaseModel {
  userId: ObjectId;
  name: string;
  level: number;
  certified: boolean;
  category: string; // "Frontend", "Backend", "DevOps", ...
  subcategory?: string; // "Frameworks", "Langages", "CI/CD", ...
  description?: string;
  yearsOfExperience?: number;
  projectsCount?: number;
  isFavorite?: boolean;
  isInLearning?: boolean;
  color?: string;
  tags?: string[];
  endorsements?: ObjectId[];
}
