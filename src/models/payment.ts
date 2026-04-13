import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";
export type PlanType = "free" | "pro" | "gold";

export interface Payment extends BaseModel {
  userId: ObjectId;
  paymentId: string; // Flouci payment_id
  plan: PlanType;
  amount: number; // en millimes TND
  status: PaymentStatus;
  developerTrackingId?: string;
}
