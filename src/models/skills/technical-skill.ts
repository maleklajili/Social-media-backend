import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface TechnicalSkill extends BaseModel {
  userId: ObjectId;
  name: string;
  level: number;
  certified: boolean;
  categoryId: ObjectId;
  description?: string;
  yearsOfExperience?: number;
  projectsCount?: number;
  isFavorite?: boolean;
  isApprenticeship?: boolean;
  color: string;
  tags?: string[];
  endorsements?: ObjectId[];
}
