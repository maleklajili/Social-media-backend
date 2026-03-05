import type { ObjectId } from "mongodb";
import type { JobApplication } from "../../models/job-application";

export interface IJobApplicationService {
  applyForJob(
    userId: ObjectId,
    jobId: ObjectId,
    application: Partial<JobApplication>,
  ): Promise<Response>;
  updateApplicationStatus(
    applicationId: ObjectId,
    status: string,
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Response>;
  getApplicationById(applicationId: ObjectId): Promise<Response>;
  getApplicationsForJob(jobId: ObjectId): Promise<Response>;
  getApplicationsForUser(userId: ObjectId): Promise<Response>;
  getApplicationsForCompany(companyId: ObjectId): Promise<Response>;
  withdrawApplication(
    applicationId: ObjectId,
    userId: ObjectId,
  ): Promise<Response>;
  respondToApplication(
    applicationId: ObjectId,
    response: string,
    companyId: ObjectId,
  ): Promise<Response>;
  rateApplication(
    applicationId: ObjectId,
    ratings: {
      experience?: number;
      skills?: number;
      qualifications?: number;
    },
    companyId: ObjectId,
  ): Promise<Response>;
}
