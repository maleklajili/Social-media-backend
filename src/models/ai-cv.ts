import type { ObjectId } from "mongodb";
import { BaseModel } from "./base/base-model";

export type AiCvStatus = "generated" | "reformulated" | "draft";

export type AiCvSection =
  | "full"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects";

export type AiCvFormat =
  | "standard"
  | "canadian"
  | "latex"
  | "modern"
  | "european";

export interface AiCv extends BaseModel {
  userId: ObjectId;
  title: string;
  content: string;
  section: AiCvSection;
  format: AiCvFormat;
  status: AiCvStatus;
  language: string;
  promptUsed?: string;
  version: number;
  parentId?: ObjectId;
}
