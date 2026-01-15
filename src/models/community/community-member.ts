import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface CommunityMember extends BaseModel {
  communityId: ObjectId;
  userId: ObjectId;
  role: "member" | "moderator" | "admin";
  joinedAt: Date;
  isMuted: boolean;
  isBanned: boolean;
  flair?: string;
}
