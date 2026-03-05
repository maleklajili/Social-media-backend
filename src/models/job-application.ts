import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export interface JobApplication extends BaseModel {
  jobId: ObjectId;
  userId: ObjectId;
  companyId: ObjectId;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  cvFileName?: string; // CV file name (stored in uploads/user-{userId}/cv/)
  coverLetter?: string;
  status: "pending" | "viewed" | "accepted" | "rejected" | "withdrawn";
  appliedAt: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  response?: string; // Response message from recruiter
  score?: number; // Matching score between job and applicant (0-100)
  ratings?: {
    experience?: number; // 0-5
    skills?: number; // 0-5
    qualifications?: number; // 0-5
  };
}
