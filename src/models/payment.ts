import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type PaymentStatus = "PENDING_VERIFICATION" | "SUCCESS" | "REJECTED";
export type PlanType = "free" | "pro" | "gold";

export interface Payment extends BaseModel {
  userId: ObjectId;
  plan: PlanType;
  amount: number; // en millimes TND
  status: PaymentStatus;
  transferProof?: string; // chemin du fichier preuve de virement
  adminNote?: string; // note de l'admin lors de la vérification
  verifiedAt?: Date;
  verifiedBy?: ObjectId;
}
