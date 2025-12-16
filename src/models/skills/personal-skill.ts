import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface PersonalSkill extends BaseModel {
  userId: ObjectId;
  name: string;
  category: string;
  description?: string;
  examples: string[];
  strength: boolean;
  endorsements: number;
  icon: string;
}
