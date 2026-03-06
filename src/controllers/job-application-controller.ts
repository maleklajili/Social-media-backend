import { Collection, ObjectId } from "mongodb";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { cvUploadMiddleware } from "../middleware/cv-upload-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { JobApplication } from "../models/job-application";
import { Get, Post, Put } from "../routes/router-manager";
import { JobApplicationService } from "../services/job-application-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { JobApplicationRepository } from "../repositories/job-application-repository";
import { JobRepository } from "../repositories/job-repository";
import { userRepository } from "../repositories/user-repository";
import { CompanyRepository } from "../repositories/company-repository";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";

export class JobApplicationController extends BaseController<
  JobApplication,
  JobApplicationService
> {
  constructor() {
    super("/job-applications");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<JobApplication> {
    return CollectionsManager.jobApplicationCollection;
  }

  protected createService(): JobApplicationService {
    return new JobApplicationService(
      new JobApplicationRepository(),
      new JobRepository(),
      new userRepository(),
      new CompanyRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  /**
   * Apply for a job with CV upload
   * POST /job-applications/apply/:jobId
   */
  @Post("/apply/:jobId", [authMiddleware])
  async apply(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const jobId = new ObjectId(req.params.jobId);

      // Handle CV upload
      const { cvData } = await cvUploadMiddleware(req, req.user._id.toString());

      const applicationData: Partial<JobApplication> = {
        coverLetter: cvData.coverLetter,
        cvFileName: cvData.cvFile?.name,
      };

      return this.service.applyForJob(req.user._id, jobId, applicationData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return ResponseHelper.error(errorMessage, 400);
    }
  }

  /**
   * Get applications for a specific job
   * GET /job-applications/job/:jobId
   */
  @Get("/job/:jobId", [authMiddleware])
  async getApplicationsForJob(req: ServerRequest): Promise<Response> {
    try {
      const jobId = new ObjectId(req.params.jobId);
      return this.service.getApplicationsForJob(jobId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get my applications (user submitted)
   * GET /job-applications/my-applications
   */
  @Get("/my-applications", [authMiddleware])
  async getMyApplications(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      return this.service.getApplicationsForUser(req.user._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get applications received by my company
   * GET /job-applications/company-applications
   */
  @Get("/company-applications", [authMiddleware])
  async getCompanyApplications(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      // TODO: Get company ID from user's companies
      // For now, we'll need to get it from query params
      const companyIdStr = (req.query as { companyId?: string })?.companyId;
      if (!companyIdStr) {
        return ResponseHelper.error("Company ID is required");
      }

      const companyId = new ObjectId(companyIdStr);
      return this.service.getApplicationsForCompany(companyId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get single application
   * GET /job-applications/:id
   */
  @Get("/:id", [authMiddleware])
  async getApplication(req: ServerRequest): Promise<Response> {
    try {
      const id = new ObjectId(req.params.id);
      return this.service.getApplicationById(id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Update application status
   * PUT /job-applications/:id/status
   */
  @Put("/:id/status", [authMiddleware])
  async updateStatus(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const id = new ObjectId(req.params.id);
      const body = (await req.json()) as { status?: string };
      const { status } = body;

      if (!status) {
        return ResponseHelper.error("Status is required");
      }

      // TODO: Get company ID from user's companies
      const companyIdStr =
        (req.query as { companyId?: string })?.companyId || "";
      const companyId = new ObjectId(companyIdStr);

      return this.service.updateApplicationStatus(
        id,
        status,
        req.user._id,
        companyId,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Withdraw application
   * PUT /job-applications/:id/withdraw
   */
  @Put("/:id/withdraw", [authMiddleware])
  async withdraw(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const id = new ObjectId(req.params.id);
      return this.service.withdrawApplication(id, req.user._id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Add response to application
   * PUT /job-applications/:id/respond
   */
  @Put("/:id/respond", [authMiddleware])
  async respond(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const id = new ObjectId(req.params.id);
      const body = (await req.json()) as { response?: string };
      const { response } = body;

      if (!response) {
        return ResponseHelper.error("Response message is required");
      }

      // TODO: Get company ID from user's companies
      const companyIdStr =
        (req.query as { companyId?: string })?.companyId || "";
      const companyId = new ObjectId(companyIdStr);

      return this.service.respondToApplication(id, response, companyId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
