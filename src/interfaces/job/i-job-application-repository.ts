import type { ObjectId } from "mongodb";
import type { JobApplication } from "../../models/job-application";

export interface IJobApplicationRepository {
  addApplication(application: JobApplication): Promise<void>;
  updateApplication(application: JobApplication): Promise<void>;
  deleteApplication(id: ObjectId): Promise<boolean>;
  getApplicationById(id: ObjectId): Promise<JobApplication | null>;
  getApplicationsByJobId(jobId: ObjectId): Promise<JobApplication[]>;
  getApplicationsByUserId(userId: ObjectId): Promise<JobApplication[]>;
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
}
