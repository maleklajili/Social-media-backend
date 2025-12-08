import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface Certification extends BaseModel {
  userId: ObjectId;
  name: string;
  file?: string;
  type?: string;
}
