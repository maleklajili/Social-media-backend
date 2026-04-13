import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";
import type { User } from "./user";

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
  vote: "up" | "down" | null;
  createdAt: Date;
}

export interface PostAward {
  type: string;
  count: number;
  awardedBy?: ObjectId[];
}

export interface Post extends BaseModel {
  // In responses this field may be replaced with the populated User object.
  userId: ObjectId | User;
  title: string;
  content: string;
  avis?: string;
  type: PostType;
  community: string | ObjectId;
  communityIcon?: string;
  privacy?: "public" | "friends" | "private";
  // Media
  media?: PostMedia[];
  url?: string;
  /* galleryConfig?: {
    aspectRatio: string;
    showArrows: boolean;
    showIndicators: boolean;
    autoPlay: boolean;
    transitionSpeed: number;
  }; */

  // Engagement (SIMPLIFIÉ)
  votes: number;
  commentsCount: number;
  views: number;
  shares: number;
  saves: number;

  sharedBy?: ObjectId[];
  originalPostId?: ObjectId;
  shareCount?: number;
  // Preview du dernier commentaire (optionnel)
  lastComment?: {
    id: ObjectId;
    userId: ObjectId;
    content: string;
    createdAt: Date;
  };

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

  // Moderation (auto-AI)
  flagged?: boolean;
  toxicityScore?: number;
  toxicityCategories?: string[];
  moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
  moderationReason?: string;
  reports?: {
    userId: ObjectId;
    reason: string;
    createdAt: Date;
  }[];
  reportCount?: number;
}
