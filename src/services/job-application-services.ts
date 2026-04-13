// services/job-application-services.ts
import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { JobApplication } from "../models/job-application";
import type { IJobApplicationRepository } from "../interfaces/job/i-job-application-repository";
import type { IJobApplicationService } from "../interfaces/job/i-job-application-service";
import type { IJobRepository } from "../interfaces/job/i-job-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import { ResponseHelper } from "../utils/response-helper";
import type { TransactionService } from "./transaction-services";
import { COINS_CONFIG } from "../utils/coins-config";

export class JobApplicationService
  extends BaseService<JobApplication>
  implements IJobApplicationService
{
  constructor(
    public applicationRepository: IJobApplicationRepository,
    public jobRepository: IJobRepository,
    private userRepository: IUserRepository,
    private companyRepository: ICompanyRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.jobApplicationCollection);
  }

  async applyForJob(
    userId: ObjectId,
    jobId: ObjectId,
    application: Partial<JobApplication>,
  ): Promise<Response> {
    try {
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error("User not found");
      }

      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      if (job.status !== "active") {
        return ResponseHelper.error("Job is no longer active");
      }

      const hasApplied = await this.applicationRepository.hasAlreadyApplied(
        jobId,
        userId,
      );
      if (hasApplied) {
        return ResponseHelper.error("You have already applied to this job");
      }

      if (!application.coverLetter || application.coverLetter.trim() === "") {
        return ResponseHelper.error("Cover letter is required");
      }

      const newApplication: JobApplication = {
        _id: new ObjectId(),
        jobId,
        userId,
        companyId: job.companyId,
        applicantName: user.firstName + " " + user.lastName,
        applicantEmail: user.email,
        applicantPhone: application.applicantPhone || user.phone,
        cvFileName: application.cvFileName,
        coverLetter: application.coverLetter,
        status: "pending",
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.addApplication(newApplication);

      const updatedJob = { ...job, applications: (job.applications || 0) + 1 };
      await this.jobRepository.updateJob(updatedJob);

      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.APPLY_JOB);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.APPLY_JOB,
          "job-application",
          newApplication._id!,
          `Candidature à l'offre d'emploi: ${job.title}`,
          {
            jobTitle: job.title,
            company: job.companyId,
            contractType: job.contractType,
          },
        );
      } catch (err) {
        console.error(" Error adding coins:", err);
      }

      return ResponseHelper.success(newApplication, 201);
    } catch (err) {
      console.error(" Error applying for job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getJobById(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found", 404);
      }
      return ResponseHelper.success(job);
    } catch (err) {
      console.error(" Error getting job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateApplicationStatus(
    applicationId: ObjectId,
    status: string,
    userId: ObjectId,
    companyId: ObjectId,
    feedback?: string,
  ): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      const job = await this.jobRepository.getJobById(application.jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      if (!job.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to update this application",
        );
      }

      const validStatuses = [
        "pending",
        "viewed",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ];
      if (!validStatuses.includes(status)) {
        return ResponseHelper.error(`Invalid status: ${status}`);
      }

      const updatedApplication: JobApplication = {
        ...application,
        status: status as JobApplication["status"],
        respondedAt: new Date(),
        updatedAt: new Date(),
        response: feedback || application.response,
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error(" Error updating application status:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationById(applicationId: ObjectId): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      const applicationWithUrl = {
        ...application,
        cvUrl: application.cvFileName
          ? `/api/job-applications/${applicationId}/cv`
          : null,
      };

      return ResponseHelper.success(applicationWithUrl, 200);
    } catch (err) {
      console.error(" Error getting application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationsForJob(
    jobId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      const skip = (page - 1) * limit;
      const { data, total } =
        await this.applicationRepository.getApplicationsByJobId(jobId, {
          skip,
          limit,
        });

      return ResponseHelper.paginated(data, page, limit, total);
    } catch (err) {
      console.error(" Error getting job applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationsForUser(
    userId: ObjectId,
    pagination: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }> {
    try {
      return await this.applicationRepository.getApplicationsByUserId(
        userId,
        pagination,
      );
    } catch (err) {
      console.error(" Error getting applications for user:", err);
      throw err;
    }
  }

  async getApplicationsForCompany(companyId: ObjectId): Promise<Response> {
    try {
      const applications =
        await this.applicationRepository.getApplicationsByCompanyId(companyId);
      return ResponseHelper.success(applications);
    } catch (err) {
      console.error(" Error getting company applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async withdrawApplication(
    applicationId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      if (!application.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to withdraw this application",
        );
      }

      if (["accepted", "rejected"].includes(application.status)) {
        return ResponseHelper.error(
          "Cannot withdraw an application that has been reviewed",
        );
      }

      const updatedApplication: JobApplication = {
        ...application,
        status: "withdrawn",
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      const job = await this.jobRepository.getJobById(application.jobId);
      if (job) {
        const updatedJob = {
          ...job,
          applications: Math.max(0, (job.applications || 0) - 1),
        };
        await this.jobRepository.updateJob(updatedJob);
      }

      return ResponseHelper.success(updatedApplication);
    } catch (err) {
      console.error(" Error withdrawing application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async respondToApplication(
    applicationId: ObjectId,
    response: string,
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      if (!response || response.trim() === "") {
        return ResponseHelper.error("Response message is required");
      }

      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      if (!application.companyId.equals(companyId)) {
        return ResponseHelper.error(
          "You don't have permission to respond to this application",
        );
      }

      const updatedApplication: JobApplication = {
        ...application,
        response,
        respondedAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error(" Error responding to application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
