import type { ObjectId } from "mongodb";
import type { Job } from "../../models/job";

export interface IJobRepository {
  addJob(job: Job): Promise<void>;
  updateJob(job: Job): Promise<void>;
  deleteJob(id: ObjectId, userId: ObjectId): Promise<boolean>;
  getJobsByCompanyId(companyId: ObjectId): Promise<Job[]>;
  getJobsByUserId(userId: ObjectId): Promise<Job[]>;
  getJobById(id: ObjectId): Promise<Job | null>;
  getActiveJobs(filters?: {
    location?: string;
    contractType?: string;
    experience?: string;
    skills?: string[];
  }): Promise<Job[]>;
  countJobs(): Promise<number>;

  getAllJobsForAdmin(
    page: number,
    limit: number,
  ): Promise<{ jobs: Job[]; total: number }>;
}
