import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Job } from "../models/job";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { JobServices } from "../services/job-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { JobRepository } from "../repositories/job-repository";
import { CompanyRepository } from "../repositories/company-repository";
import { userRepository } from "../repositories/user-repository";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";

export class JobController extends BaseController<Job, JobServices> {
  constructor() {
    super("/jobs");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Job> {
    return CollectionsManager.jobCollection;
  }

  protected createService(): JobServices {
    return new JobServices(
      new JobRepository(),
      new CompanyRepository(),
      new userRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  @Get("/getAll", [paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: any = {};

      if (req.query?.location) {
        filters.location = req.query.location;
      }

      if (req.query?.contractType) {
        filters.contractType = req.query.contractType;
      }

      if (req.query?.experience) {
        filters.experience = req.query.experience;
      }

      if (req.query?.skills) {
        filters.skills = req.query.skills;
      }

      if (req.query?.companyId) {
        filters.companyId = req.query.companyId;
      }

      // Only show active jobs for public endpoint
      filters.status = "active";

      return this.service.getActiveJobs(filters);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/my-jobs", [authMiddleware, paginationMiddleware])
  async getMyJobs(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const filter = { userId: req.user._id };
      return super.getAll(req, [], filter);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/add-job", [authMiddleware])
  async addJob(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const body = (await req.json()) as Job;

      // Validate required fields
      if (!body.companyId || !ObjectId.isValid(body.companyId.toString())) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      body.companyId = new ObjectId(body.companyId);

      return this.service.addJob(req.user._id, body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-job/:id", [authMiddleware])
  async updateJob(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing job id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const body = (await req.json()) as Job;

      return this.service.updateJob(req.user._id, new ObjectId(id), body);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete/:id", [authMiddleware])
  async deleteJob(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing job id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      return this.service.deleteJob(req.user._id, new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/company/:companyId")
  async getJobsByCompanyId(req: ServerRequest): Promise<Response> {
    try {
      const { companyId } = req.params;
      if (!companyId || !ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      const jobs = await this.service.getJobsByCompanyId(
        new ObjectId(companyId),
      );
      return jobs;
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/user/:userId")
  async getJobsByUserId(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid or missing user id");
      }

      const jobs = await this.service.getJobsByUserId(new ObjectId(userId));
      return jobs;
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:id")
  async getJobById(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing job id");
      }

      return this.service.getJobById(new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/toggle-status/:id", [authMiddleware])
  async toggleJobStatus(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing job id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      // Typez correctement le body
      interface ToggleStatusBody {
        status: "active" | "draft" | "closed" | "expired";
      }

      const body = (await req.json()) as ToggleStatusBody;

      if (
        !body.status ||
        !["active", "draft", "closed", "expired"].includes(body.status)
      ) {
        return ResponseHelper.error("Invalid status");
      }

      // Check if job belongs to user
      const existingJob = await this.collection.findOne({
        _id: new ObjectId(id),
        userId: req.user._id,
      });

      if (!existingJob) {
        return ResponseHelper.error("Job not found or access denied");
      }

      // Update status - maintenant body.status est correctement typé
      await this.collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: body.status, updatedAt: new Date() } },
      );

      return ResponseHelper.success({
        message: "Job status updated successfully",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/feature/:id", [authMiddleware])
  async toggleFeatured(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing job id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      // Check if job belongs to user
      const existingJob = await this.collection.findOne({
        _id: new ObjectId(id),
        userId: req.user._id,
      });

      if (!existingJob) {
        return ResponseHelper.error("Job not found or access denied");
      }

      // Toggle featured status
      const newFeaturedStatus = !existingJob.isFeatured;

      await this.collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeatured: newFeaturedStatus, updatedAt: new Date() } },
      );

      return ResponseHelper.success({
        message: "Job featured status updated successfully",
        isFeatured: newFeaturedStatus,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
