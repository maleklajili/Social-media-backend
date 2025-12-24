// models/transaction.ts
import { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type TransactionType = "earned" | "spent" | "purchased";

export interface Transaction extends BaseModel {
  userId: ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  itemType?: string; // "experience", "education", "project", "skill"
  itemId?: ObjectId | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}
