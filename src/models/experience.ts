import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface Experience extends BaseModel {
  userId: ObjectId;
  post: string;
  entreprise: string;
  place: string;
  description: string;
  startDate: Date;
  endDate: Date;
  currentPost: boolean;
  KeyAchievements: string[];
  certificates: ObjectId[];
  skills: ObjectId[];
}
