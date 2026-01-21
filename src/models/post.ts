import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type PostType = "text" | "image" | "video" | "link" | "poll" | "gallery";

export type MediaType = "image" | "video" | "document";

export interface PostMedia {
  id: string;
  type: MediaType;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  caption?: string;
  order?: number;
  mimeType?: string;
}

export interface PostVote {
  userId: ObjectId;
  vote: "up" | "down";
  createdAt: Date;
}

export interface PostComment {
  id: string;
  userId: ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  votes: number;
  replies?: PostComment[];
}

export interface PostAward {
  type: string;
  count: number;
  awardedBy?: ObjectId[];
}

export interface Post extends BaseModel {
  userId: ObjectId;
  title: string;
  content: string;
  type: PostType;
  community: string;
  communityIcon?: string;

  // Media
  media?: PostMedia[];
  url?: string;
  galleryConfig?: {
    aspectRatio: string;
    showArrows: boolean;
    showIndicators: boolean;
    autoPlay: boolean;
    transitionSpeed: number;
  };

  // Engagement
  votes: number;
  comments: PostComment[]; // Correction: c'est un tableau, pas un nombre
  commentsCount: number; // Ajouter pour compter le total
  views: number;
  shares: number;
  saves: number;

  // User interaction
  userVotes?: PostVote[];
  userVote?: "up" | "down" | null;
  savedBy?: ObjectId[];

  // Analytics
  awards?: PostAward[];
  trendingScore?: number;
  suggested?: boolean;
  nsfw?: boolean;
  spoiler?: boolean;
  pinned?: boolean;

  // Metadata
  tags?: string[];
  mentions?: ObjectId[];
  pollOptions?: {
    text: string;
    votes: number;
    voters: ObjectId[];
  }[];
  pollEndsAt?: Date;

  // Timestamps
  publishedAt?: Date;
  lastActivityAt: Date;
}
