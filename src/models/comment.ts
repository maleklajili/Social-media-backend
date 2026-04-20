import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface CommentVote {
  userId: ObjectId;
  vote: "up" | "down";
  createdAt: Date;
}

export interface Comment extends BaseModel {
  postId: ObjectId;
  userId: ObjectId;
  content: string;

  // Réponses hiérarchiques
  parentCommentId: ObjectId | null;
  repliesCount: number;

  // Engagement
  votes: number;
  userVotes?: CommentVote[];
  userVote?: "up" | "down" | null;

  // Modération
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  reports?: {
    userId: ObjectId;
    reason: string;
    createdAt: Date;
  }[];

  // Métadonnées
  mentions?: ObjectId[];
  media?: {
    type: "image" | "video";
    url: string;
    thumbnail?: string;
  }[];
  ownerType?: "user" | "company";
  ownerId?: ObjectId;
  ownerData?: {
    _id: ObjectId;
    name: string;
    logo?: string;
    userId?: string;
  };
}
