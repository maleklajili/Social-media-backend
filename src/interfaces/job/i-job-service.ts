import type { ObjectId } from "mongodb";
import type { Job } from "../../models/job";

export interface IJobService {
  addJob(userId: ObjectId, job: Job): Promise<Response>;
  updateJob(userId: ObjectId, jobId: ObjectId, job: Job): Promise<Response>;
  deleteJob(
    userId: ObjectId,
    jobId: ObjectId,
    isAdmin: boolean,
  ): Promise<Response>;
  getJobsByCompanyId(companyId: ObjectId): Promise<Response>;
  getJobsByUserId(userId: ObjectId): Promise<Response>;
  getJobById(jobId: ObjectId): Promise<Response>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getActiveJobs(filters?: Record<string, any>): Promise<Response>;
  getTotalJobs(): Promise<Response>;
  getAllJobsForAdmin(page: number, limit: number): Promise<Response>;
}
