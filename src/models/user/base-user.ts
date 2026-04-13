import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface BaseUser extends BaseModel {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  birthday: Date;
  image?: string;
  cover?: string;
  bio: string;
  city: string;
  adress: string;
  professionalTitle: string;
  postalCode: number;
  phone: string;
  website: string;
  location: string;
  fullName: string;
  coins: number;
  plan?: "free" | "pro" | "gold";
  planExpiry?: Date;
  isAdmin?: boolean;
  skills?: [ObjectId];
  followers?: ObjectId[];
  following?: ObjectId[];
  followingCompanies?: ObjectId[];
  followerCount?: number;
  followingCount?: number;

  // Moderation (auto-AI)
  isFlagged?: boolean;
  fakeScore?: number;
  fakeFlags?: string[];
  isBanned?: boolean;
  banReason?: string;
  warningCount?: number;
}
