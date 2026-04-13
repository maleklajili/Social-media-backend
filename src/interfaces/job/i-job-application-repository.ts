import type { ObjectId } from "mongodb";
import type { JobApplication } from "../../models/job-application";

export interface IJobApplicationRepository {
  addApplication(application: JobApplication): Promise<void>;
  updateApplication(application: JobApplication): Promise<void>;
  deleteApplication(id: ObjectId): Promise<boolean>;
  getApplicationById(id: ObjectId): Promise<JobApplication | null>;
  getApplicationsByJobId(
    jobId: ObjectId,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }>;
  getApplicationsByUserId(
    userId: ObjectId,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }>;
  getApplicationsByCompanyId(companyId: ObjectId): Promise<JobApplication[]>;
  getApplicationsByStatus(
    status: string,
    companyId?: ObjectId,
  ): Promise<JobApplication[]>;
  hasAlreadyApplied(jobId: ObjectId, userId: ObjectId): Promise<boolean>;
  countApplicationsForJob(jobId: ObjectId): Promise<number>;
  countApplicationsForUser(userId: ObjectId): Promise<number>;
  countApplicationsForCompany(companyId: ObjectId): Promise<number>;
  getApplicationsByJobAndStatus(
    jobId: ObjectId,
    status: string,
  ): Promise<JobApplication[]>;
  updateApplicationScore(applicationId: ObjectId, score: number): Promise<void>;
  getApplicationsByJobIdRanked(jobId: ObjectId): Promise<JobApplication[]>;
}
