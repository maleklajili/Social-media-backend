import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface Company extends BaseModel {
  userId: ObjectId;
  name: string;
  industry: string;
  description: string;
  shortDescription: string;
  website: string;
  foundedYear?: string;
  size: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  coverImage: string;
  jobs?: ObjectId[];
  followersId?: ObjectId[];
  averageRating?: number;
  reviewCount?: number;
  reviewIds?: ObjectId[];
  socialMedia: {
    linkedin: string;
    twitter: string;
    facebook: string;
    instagram: string;
  };
  keywords: string[];
  status: "active" | "draft" | "archived";
  verified: boolean;
  verificationStatus: "verified" | "pending" | "rejected" | "not_requested";
  verificationDocuments?: {
    file: string;
    type: string;
    name: string;
  }[];
  verificationNotes?: string; // Note de l'entreprise à l'admin
  adminResponse?: string; // Réponse de l'admin à l'entreprise (NOUVEAU)
  adminResponseDate?: Date; // Date de la réponse de l'admin (NOUVEAU)
  stats: {
    views: number;
    followers: number;
    jobApplications: number;
    messages: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
