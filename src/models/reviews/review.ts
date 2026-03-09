// models/review.ts
import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface Review extends BaseModel {
  companyId: ObjectId;
  userId: ObjectId;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}
