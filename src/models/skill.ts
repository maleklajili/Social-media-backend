import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export enum SkillLevel {
  Débutant = "debutant",
  Intermédiaire = "intermediaire",
  Avancé = "avance",
  Expert = "expert",
  Natif = "natif",
}
export interface Skill extends BaseModel {
  // Ownership
  userId: ObjectId;
  // Classification
  categorie: string;
  sousCategorie: string;
  // Skill Details
  name: string;
  level?: SkillLevel;
  description?: string;
  color?: string;
  // Metrics
  experienceNumber?: number;
  projectNumber?: number;
  percentage?: number;
  // Certifications
  certifications?: ObjectId[];
  certifed?: boolean;
  // Flags
  favorite?: boolean;
  apprenticeship?: boolean;
}
