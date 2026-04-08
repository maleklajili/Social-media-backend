import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Job } from "../models/job";
import { CollectionsManager } from "../models/base/collection-manager";
import type { IJobRepository } from "../interfaces/job/i-job-repository";
import type { IJobService } from "../interfaces/job/i-job-service";
import { ResponseHelper } from "../utils/response-helper";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { TransactionService } from "./transaction-services";
import { COINS_CONFIG } from "../utils/coins-config";

export class JobServices extends BaseService<Job> implements IJobService {
  constructor(
    private jobRepository: IJobRepository,
    private companyRepository: ICompanyRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.jobCollection);
  }

  /**
   * Add a new job
   */
  async addJob(userId: ObjectId, job: Job): Promise<Response> {
    try {
      // Validation
      if (!job.title || !job.description) {
        return ResponseHelper.error("Title and description are required.");
      }

      // Verify company exists and belongs to user
      const company = await this.companyRepository.getCompanyById(
        job.companyId,
      );
      if (!company) {
        return ResponseHelper.error("Company not found.");
      }

      if (!company.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to post jobs for this company.",
        );
      }

      // Verify company is verified to post jobs (optional requirement)
      /*    if (!company.verified && company.verificationStatus !== "verified") {
        return ResponseHelper.error("Company must be verified to post jobs.");
      } */

      // Set job properties
      job.userId = userId;
      job.status = "active";
      job.isFeatured = false;
      job.views = 0;
      job.applications = 0;
      job.publishedAt = new Date();

      // Set expiration date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      job.expiresAt = expiresAt;

      // Convert salary to numbers if provided
      if (job.salaryMin) {
        job.salaryMin = Number(job.salaryMin);
      }
      if (job.salaryMax) {
        job.salaryMax = Number(job.salaryMax);
      }

      // Save job
      await this.jobRepository.addJob(job);
      // Add job reference to company
      if (job._id) {
        await this.companyRepository.addJobToCompany(job.companyId, job._id);
      }
      // Add coins for posting a job
      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_JOB);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.ADD_JOB,
          "job",
          job._id!,
          `Publication d'une offre d'emploi`,
          {
            title: job.title,
            company: company.name,
            contractType: job.contractType,
            location: job.location,
          },
        );
      } catch (err) {
        console.error("❌ Error adding coins:", err);
      }

      return ResponseHelper.success(job);
    } catch (err) {
      console.error("❌ Error adding job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getAllJobsForAdmin(page: number, limit: number): Promise<Response> {
    try {
      const { jobs, total } = await this.jobRepository.getAllJobsForAdmin(
        page,
        limit,
      );
      return ResponseHelper.success({
        data: jobs,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalCount: total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error(" Error in getAllJobsForAdmin:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  /**
   * Update existing job
   */
  async updateJob(
    userId: ObjectId,
    jobId: ObjectId,
    job: Job,
  ): Promise<Response> {
    try {
      // Check if job exists and belongs to user
      const existingJob = await this.collection.findOne({
        _id: jobId,
        userId,
      });

      if (!existingJob) {
        return ResponseHelper.error("Job not found or access denied");
      }

      // Assign ID and userId
      job._id = jobId;
      job.userId = userId;

      // Keep existing stats
      job.views = existingJob.views;
      job.applications = existingJob.applications;
      job.publishedAt = existingJob.publishedAt;
      job.expiresAt = existingJob.expiresAt;

      // Keep company info
      job.companyId = existingJob.companyId;

      // Convert salary to numbers if provided
      if (job.salaryMin !== undefined) {
        job.salaryMin = Number(job.salaryMin);
      }
      if (job.salaryMax !== undefined) {
        job.salaryMax = Number(job.salaryMax);
      }

      // Update job
      await this.jobRepository.updateJob(job);

      return ResponseHelper.success(job);
    } catch (err) {
      console.error("❌ Error updating job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // job-services.ts
  async deleteJob(
    userId: ObjectId,
    jobId: ObjectId,
    isAdmin: boolean,
  ): Promise<Response> {
    try {
      // 1. Récupérer l'offre sans restriction d'utilisateur
      const existingJob = await this.collection.findOne({
        _id: jobId,
      });

      if (!existingJob) {
        return ResponseHelper.error("Job not found");
      }

      // 2. Vérifier les droits : propriétaire OU admin
      const isOwner = existingJob.userId.equals(userId);
      if (!isOwner && !isAdmin) {
        return ResponseHelper.error(
          "Access denied: you are not the owner or admin",
        );
      }

      // 3. Supprimer la référence dans l'entreprise (toujours nécessaire)
      await this.companyRepository.removeJobFromCompany(
        existingJob.companyId,
        jobId,
      );

      // 4. Retirer les coins du propriétaire (même si c'est un admin qui supprime)
      try {
        await this.userRepository.removeCoins(
          existingJob.userId,
          COINS_CONFIG.REMOVE_JOB,
        );
        await this.transactionService.addStandardSpending(
          existingJob.userId,
          "job",
          jobId,
          `Suppression d'une offre d'emploi par ${isAdmin ? "admin" : "propriétaire"}`,
          COINS_CONFIG.REMOVE_JOB,
        );
      } catch (err) {
        console.error("❌ Error removing coins:", err);
      }

      // 5. Supprimer l'offre de la base
      await this.jobRepository.deleteJob(jobId, existingJob.userId);

      return ResponseHelper.success({
        message: "Job deleted successfully",
      });
    } catch (err) {
      console.error("❌ Error deleting job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getJobsByCompanyId(companyId: ObjectId): Promise<Response> {
    try {
      const jobs = await this.jobRepository.getJobsByCompanyId(companyId);
      return ResponseHelper.success(jobs);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getJobsByUserId(userId: ObjectId): Promise<Response> {
    try {
      const jobs = await this.jobRepository.getJobsByUserId(userId);
      return ResponseHelper.success(jobs);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getJobById(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      // Increment view count
      await this.collection.updateOne({ _id: jobId }, { $inc: { views: 1 } });

      return ResponseHelper.success(job);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getActiveJobs(filters?: Record<string, any>): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryFilters: any = {};

      if (filters) {
        if (filters.location) {
          queryFilters.location = { $regex: filters.location, $options: "i" };
        }

        if (filters.contractType) {
          queryFilters.contractType = filters.contractType;
        }

        if (filters.experience) {
          queryFilters.experience = filters.experience;
        }

        if (filters.skills) {
          const skills = Array.isArray(filters.skills)
            ? filters.skills
            : filters.skills.split(",");

          if (skills.length > 0) {
            queryFilters.skills = { $in: skills };
          }
        }

        if (filters.companyId) {
          queryFilters.companyId = new ObjectId(filters.companyId);
        }
      }

      queryFilters.status = "active";
      queryFilters.expiresAt = { $gt: new Date() };
      const jobs = await this.collection.find(queryFilters).toArray();
      return ResponseHelper.success(jobs);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTotalJobs(): Promise<Response> {
    try {
      const count = await this.jobRepository.countJobs();
      return ResponseHelper.success({ total: count });
    } catch (err) {
      console.error("❌ Error counting jobs:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
