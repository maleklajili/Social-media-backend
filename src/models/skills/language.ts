import type { ObjectId } from "mongodb";
import type { BaseModel } from "../../models/base/base-model";

export interface Language extends BaseModel {
  userId: ObjectId;
  code: string;
  name: string;
  nativeName: string;
  level: string;
  proficiency: number; // 0-100
  flag?: string;
  fluency: string;
  reading: number;
  writing: number;
  speaking: number;
  listening: number;
  accent?: string;
  lastPractice: string;
  contexts?: string[];
}
