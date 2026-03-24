import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface Community extends BaseModel {
  name: string; // Nom unique de la communauté (ex: "webdesign")
  title: string; // Titre affiché (ex: "Web Design")
  description: string;
  icon: string; // Emoji
  banner?: string; // URL de la bannière
  members: number; // Nombre de membres
  memberIds: ObjectId[];
  online: number; // Nombre en ligne
  createdBy: ObjectId; // ID du créateur
  isPublic: boolean;
  category: string; // "technology", "art", "gaming", etc.
  tags: string[];
}
