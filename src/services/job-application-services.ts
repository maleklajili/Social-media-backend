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
    private applicationRepository: IJobApplicationRepository,
    private jobRepository: IJobRepository,
    private userRepository: IUserRepository,
    private companyRepository: ICompanyRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.jobApplicationCollection);
  }

  /**
   * Apply for a job
   */
  async applyForJob(
    userId: ObjectId,
    jobId: ObjectId,
    application: Partial<JobApplication>,
  ): Promise<Response> {
    try {
      // Validate user exists
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error("User not found");
      }

      // Validate job exists and is active
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      if (job.status !== "active") {
        return ResponseHelper.error("Job is no longer active");
      }

      // Check if user already applied
      const hasApplied = await this.applicationRepository.hasAlreadyApplied(
        jobId,
        userId,
      );
      if (hasApplied) {
        return ResponseHelper.error("You have already applied to this job");
      }

      // Validate required fields
      if (!application.coverLetter || application.coverLetter.trim() === "") {
        return ResponseHelper.error("Cover letter is required");
      }

      // Create application
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

      // Save application
      await this.applicationRepository.addApplication(newApplication);

      // Increment job applications count
      const updatedJob = { ...job, applications: (job.applications || 0) + 1 };
      await this.jobRepository.updateJob(updatedJob);

      // Add coins for applying
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
        console.error("❌ Error adding coins:", err);
      }

      return ResponseHelper.success(newApplication, 201);
    } catch (err) {
      console.error("❌ Error applying for job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(
    applicationId: ObjectId,
    status: string,
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      console.log(companyId);
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      // Verify user has permission (must be the job owner or company owner)
      const job = await this.jobRepository.getJobById(application.jobId);
      if (!job || !job.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to update this application",
        );
      }

      // Validate status
      const validStatuses = ["pending", "viewed", "accepted", "rejected"];
      if (!validStatuses.includes(status)) {
        return ResponseHelper.error("Invalid status");
      }

      // Update application
      const updatedApplication: JobApplication = {
        ...application,
        status: status as "pending" | "viewed" | "accepted" | "rejected",
        respondedAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      // Add coins for reviewing applications (if moving from pending)
      if (application.status === "pending") {
        try {
          await this.userRepository.addCoins(
            userId,
            COINS_CONFIG.REVIEW_APPLICATION,
          );
          await this.transactionService.addStandardEarning(
            userId,
            COINS_CONFIG.REVIEW_APPLICATION,
            "application-review",
            applicationId,
            `Examen de candidature pour ${application.applicantName}`,
            {
              applicantName: application.applicantName,
              jobTitle: job.title,
              status,
            },
          );
        } catch (err) {
          console.error("❌ Error adding coins:", err);
        }
      }

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error("❌ Error updating application status:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get application by ID
   */
  async getApplicationById(applicationId: ObjectId): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      return ResponseHelper.success(application);
    } catch (err) {
      console.error("❌ Error getting application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get applications for a specific job
   */
  async getApplicationsForJob(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      const applications =
        await this.applicationRepository.getApplicationsByJobId(jobId);

      return ResponseHelper.success(applications, 200);
    } catch (err) {
      console.error("❌ Error getting job applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get applications submitted by a user
   */
  async getApplicationsForUser(userId: ObjectId): Promise<Response> {
    try {
      const applications =
        await this.applicationRepository.getApplicationsByUserId(userId);

      return ResponseHelper.success(applications);
    } catch (err) {
      console.error("❌ Error getting user applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get applications received by a company
   */
  async getApplicationsForCompany(companyId: ObjectId): Promise<Response> {
    try {
      const applications =
        await this.applicationRepository.getApplicationsByCompanyId(companyId);

      return ResponseHelper.success(applications);
    } catch (err) {
      console.error("❌ Error getting company applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Withdraw application
   */
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

      // Verify user owns the application
      if (!application.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to withdraw this application",
        );
      }

      // Can't withdraw if already accepted/rejected
      if (["accepted", "rejected"].includes(application.status)) {
        return ResponseHelper.error(
          "Cannot withdraw an application that has been reviewed",
        );
      }

      // Update application status
      const updatedApplication: JobApplication = {
        ...application,
        status: "withdrawn",
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      // Decrement job applications count
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
      console.error("❌ Error withdrawing application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Respond to application with message
   */
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

      // Verify user has permission
      if (!application.companyId.equals(companyId)) {
        return ResponseHelper.error(
          "You don't have permission to respond to this application",
        );
      }

      // Update application
      const updatedApplication: JobApplication = {
        ...application,
        response,
        respondedAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error("❌ Error responding to application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Rate application
   */
  async rateApplication(
    applicationId: ObjectId,
    ratings: {
      experience?: number;
      skills?: number;
      qualifications?: number;
    },
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      // Verify user has permission
      if (!application.companyId.equals(companyId)) {
        return ResponseHelper.error(
          "You don't have permission to rate this application",
        );
      }

      // Validate ratings (0-5)
      const validateRating = (rating?: number) => {
        if (rating !== undefined && (rating < 0 || rating > 5)) {
          throw new Error("Ratings must be between 0 and 5");
        }
      };

      validateRating(ratings.experience);
      validateRating(ratings.skills);
      validateRating(ratings.qualifications);

      // Calculate average score
      const validRatings = Object.values(ratings).filter(
        (r) => r !== undefined,
      ) as number[];
      const score =
        validRatings.length > 0
          ? Math.round(
              (validRatings.reduce((a, b) => a + b, 0) / validRatings.length) *
                20,
            )
          : undefined;

      // Update application
      const updatedApplication: JobApplication = {
        ...application,
        ratings,
        score,
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error("❌ Error rating application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
