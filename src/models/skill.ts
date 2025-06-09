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
  userId: ObjectId;
  categorie: string;
  name: string;
  level: SkillLevel; // enum
  percentage: number;
  certifications: ObjectId[];
}
