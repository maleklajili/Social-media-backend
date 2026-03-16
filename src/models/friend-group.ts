import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface FriendGroup extends BaseModel {
  userId: ObjectId;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  members: ObjectId[];
  membersCount?: number;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
