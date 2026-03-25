// controllers/job-application-controller.ts
import { Collection, ObjectId } from "mongodb";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { cvUploadMiddleware } from "../middleware/cv-upload-middleware";
import fs from "fs";
import path from "path";

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
import type { RequestWithPagination } from "../config/interfaces/i-pagination";

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

  @Post("/apply/:jobId", [authMiddleware])
  async apply(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const jobId = new ObjectId(req.params.jobId);

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

  @Get("/job/:jobId", [authMiddleware])
  async getApplicationsForJob(req: ServerRequest): Promise<Response> {
    try {
      const jobId = new ObjectId(req.params.jobId);
      return this.service.getApplicationsForJob(jobId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/my-applications", [authMiddleware])
  async getMyApplications(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const page = parseInt(req.query?.page as string) || 1;
      const limit = parseInt(req.query?.limit as string) || 10;
      const skip = (page - 1) * limit;

      const result = await this.service.getApplicationsForUser(req.user._id, {
        skip,
        limit,
      });

      return ResponseHelper.paginated(result.data, page, limit, result.total);
    } catch (err) {
      console.error("❌ Error getting my applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/company-applications", [authMiddleware])
  async getCompanyApplications(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

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

  @Get("/:id", [authMiddleware])
  async getApplication(req: ServerRequest): Promise<Response> {
    try {
      const id = new ObjectId(req.params.id);
      return this.service.getApplicationById(id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/:id/status", [authMiddleware])
  async updateStatus(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }

      const id = new ObjectId(req.params.id);
      const body = (await req.json()) as { status?: string; feedback?: string };
      const { status, feedback } = body;

      if (!status) {
        return ResponseHelper.error("Status is required");
      }

      const companyIdStr =
        (req.query as { companyId?: string })?.companyId || "";
      const companyId = new ObjectId(companyIdStr);

      return this.service.updateApplicationStatus(
        id,
        status,
        req.user._id,
        companyId,
        feedback,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

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

      const companyIdStr =
        (req.query as { companyId?: string })?.companyId || "";
      const companyId = new ObjectId(companyIdStr);

      return this.service.respondToApplication(id, response, companyId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Download CV - Version corrigée
   * GET /job-applications/:id/download-cv
   */
  @Get("/:id/download-cv", [authMiddleware])
  async downloadCV(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const applicationId = new ObjectId(req.params.id);

      const application =
        await this.service.applicationRepository.getApplicationById(
          applicationId,
        );

      if (!application) {
        return ResponseHelper.error("Application not found", 404);
      }

      if (!application.cvFileName) {
        return ResponseHelper.error("No CV file attached", 404);
      }

      const isApplicant = application.userId.equals(req.user._id);
      const job = await this.service.jobRepository.getJobById(
        application.jobId,
      );
      const isRecruiter = job && job.userId && job.userId.equals(req.user._id);

      if (!isApplicant && !isRecruiter) {
        return ResponseHelper.error(
          "You don't have permission to download this CV",
          403,
        );
      }

      const userId = application.userId.toString();
      const fileName = application.cvFileName;

      const possiblePaths = [
        path.join(process.cwd(), "uploads", `images-${userId}`, "cv", fileName),
        path.join(process.cwd(), "uploads", `images-${userId}`, fileName),
        path.join(
          process.cwd(),
          "uploads",
          `images-${userId}`,
          "messages",
          fileName,
        ),
        path.join(process.cwd(), "uploads", `documents-${userId}`, fileName),
      ];

      let fileBuffer: Buffer | null = null;
      let fileFound = false;

      for (const checkPath of possiblePaths) {
        if (fs.existsSync(checkPath)) {
          fileBuffer = fs.readFileSync(checkPath);
          fileFound = true;
          break;
        }
      }

      if (!fileFound || !fileBuffer) {
        console.error(`CV file not found: ${fileName} for user ${userId}`);
        return ResponseHelper.error(`CV file not found: ${fileName}`, 404);
      }

      const ext = fileName.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };

      const mimeType =
        ext && mimeTypes[ext] ? mimeTypes[ext] : "application/octet-stream";

      const headers = new Headers();
      headers.set("Content-Type", mimeType);
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileName)}"`,
      );
      headers.set("Content-Length", fileBuffer.length.toString());

      return new Response(fileBuffer, {
        status: 200,
        headers: headers,
      });
    } catch (err) {
      console.error(" Error downloading CV:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
