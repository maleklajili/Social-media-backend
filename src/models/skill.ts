import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export enum SkillLevel {
  Débutant = "Débutant",
  Intermédiaire = "Intermédiaire",
  Avancé = "Avancé",
  Expert = "Expert",
}

export interface Skill extends BaseModel {
  userId: ObjectId;
  categorie: string;
  name: string;
  level: SkillLevel; // enum
  percentage: number;
  certifications: ObjectId[];
}
