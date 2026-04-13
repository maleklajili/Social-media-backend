import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type ReportedItemType = "post" | "comment" | "user";

export type ReportReason =
  | "spam"
  | "abuse"
  | "harassment"
  | "hate_speech"
  | "misinformation"
  | "explicit_content"
  | "copyright"
  | "scam"
  | "violence"
  | "other";

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface Report extends BaseModel {
  // Informations du signalement
  reportedItemType: ReportedItemType;
  reportedItemId: ObjectId;
  reportedById: ObjectId;

  // Détails du contenu signalé
  reportReason: ReportReason;
  description: string;
  priority?: "low" | "medium" | "high";

  // Statut et modération
  status: ReportStatus;
  resolvedAt?: Date;
  resolvedBy?: ObjectId; // Admin qui a traité le signalement
  resolutionNotes?: string;

  // Autres signalements similaires
  relatedReports?: ObjectId[];

  // Métadonnées
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    postTitle?: string;
    userName?: string;
    communityName?: string;
  };
}
