import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface Education extends BaseModel {
  userId: ObjectId;
  degree: string;
  school: string;
  location: string;
  startDate: Date;
  endDate?: Date;
  description: string;
  current: boolean;
  type: "diploma" | "certification" | "course";
  grade?: string;
  skills: ObjectId[]; // Références aux compétences
  certificates?: ObjectId[]; // Références aux certificats
  url?: string;
  featured?: boolean;
  color?: string;
  icon?: string;
  progress?: number;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  score?: number;
  tags?: string[];
}
