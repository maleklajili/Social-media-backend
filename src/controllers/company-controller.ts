import { Collection, ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import { autoPaginateResponse } from "../middleware/pagination-middleware";
import type { Company } from "../models/company";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { CompanyServices } from "../services/company-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { CompanyRepository } from "../repositories/company-repository";
import { userRepository } from "../repositories/user-repository";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";
import { JobRepository } from "../repositories/job-repository";

export class CompanyController extends BaseController<
  Company,
  CompanyServices
> {
  constructor() {
    super("/companies");
    this.initializeService(this.createService());
  }

  protected initializeCollection(): Collection<Company> {
    return CollectionsManager.companyCollection;
  }

  protected createService(): CompanyServices {
    return new CompanyServices(
      new CompanyRepository(),
      new userRepository(),
      new JobRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const andConditions: Filter<Company>[] = [];

      if (req.query?.status) {
        const status = req.query.status as string;
        if (
          status === "active" ||
          status === "draft" ||
          status === "archived"
        ) {
          andConditions.push({ status });
        }
      }

      if (req.query?.userId) {
        andConditions.push({
          userId: new ObjectId(req.query.userId as string),
        });
      }

      if (req.query?.verified !== undefined) {
        andConditions.push({ verified: req.query.verified === "true" });
      }

      // Filtre par industrie =
      if (req.query?.industry) {
        const industries = Array.isArray(req.query.industry)
          ? req.query.industry
          : [req.query.industry];
        andConditions.push({ industry: { $in: industries as string[] } });
      }

      //  Filtre par taille
      if (req.query?.size) {
        const sizes = Array.isArray(req.query.size)
          ? req.query.size
          : [req.query.size];
        andConditions.push({ size: { $in: sizes as string[] } });
      }

      // Filtre par caractéristiques
      if (req.query?.feature) {
        const features = Array.isArray(req.query.feature)
          ? req.query.feature
          : [req.query.feature];

        for (const feat of features as string[]) {
          switch (feat) {
            case "verified":
              andConditions.push({ verified: true });
              break;
            case "trending":
              andConditions.push({ "stats.followers": { $gt: 50 } });
              break;
            case "hasJobOffers":
              andConditions.push({
                jobs: { $exists: true, $not: { $size: 0 } },
              });
              break;
          }
        }
      }

      // Recherche textuelle
      const searchOrConditions: Filter<Company>[] = [];
      if (req.query?.search) {
        const searchRegex = new RegExp(req.query.search as string, "i");
        searchOrConditions.push(
          { name: searchRegex },
          { description: searchRegex },
          { shortDescription: searchRegex },
          { industry: searchRegex },
          { location: searchRegex },
          { address: searchRegex },
          { keywords: searchRegex },
        );
      }

      //  Filtre localisation
      const locationOrConditions: Filter<Company>[] = [];
      if (req.query?.location) {
        const locationRegex = new RegExp(req.query.location as string, "i");
        locationOrConditions.push(
          { location: locationRegex },
          { address: locationRegex },
        );
      }

      const textAndConditions: Filter<Company>[] = [];
      if (searchOrConditions.length > 0) {
        textAndConditions.push({ $or: searchOrConditions });
      }
      if (locationOrConditions.length > 0) {
        textAndConditions.push({ $or: locationOrConditions });
      }

      if (textAndConditions.length === 1) {
        andConditions.push(textAndConditions[0]!);
      } else if (textAndConditions.length === 2) {
        andConditions.push({ $and: textAndConditions });
      }

      const filter: Filter<Company> =
        andConditions.length > 0 ? { $and: andConditions } : {};

      const pagination = req.pagination;
      if (!pagination) {
        return ResponseHelper.error("Pagination manquante");
      }

      const result = await this.service.getAllCompaniesWithFollowStatus(
        req.user._id,
        filter,
        { skip: pagination.skip, limit: pagination.take },
      );

      return autoPaginateResponse(
        req,
        Promise.resolve(result.data),
        Promise.resolve(result.total),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Post("/add-company", [authMiddleware])
  async addCompany(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Company>(formData);

      return this.service.addCompany(req.user._id, body, formData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/update-company/:id", [authMiddleware])
  async updateCompany(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const formData = (await req.formData()) as FormData;
      const body = await this.parseFormData<Company>(formData);

      return this.service.updateCompany(
        req.user._id,
        new ObjectId(id),
        body,
        formData,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/delete/:id", [authMiddleware])
  async deleteCompany(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      if (!req.user?._id) {
        return ResponseHelper.error("undefined current user");
      }

      const usersCollection = CollectionsManager.userCollection;
      const user = await usersCollection.findOne({ _id: req.user._id });
      const isAdmin = user?.isAdmin === true;

      const result = await this.service.deleteCompany(
        req.user._id,
        new ObjectId(id),
        isAdmin,
      );
      return result;
    } catch (err) {
      console.error(" Controller error:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/user/:userId", [authMiddleware])
  async getCompaniesByUserId(req: ServerRequest): Promise<Response> {
    try {
      const { userId } = req.params;
      if (!userId || !ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid or missing user id");
      }

      const companies = await this.service.getCompaniesByUserId(
        new ObjectId(userId),
      );
      return companies;
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/stats", [authMiddleware])
  async getStats(): Promise<Response> {
    try {
      const stats = await this.service.getAggregatedStats();
      return ResponseHelper.success(stats);
    } catch (err) {
      console.error("❌ Error fetching stats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/follow/:id", [authMiddleware])
  async followCompany(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.followCompany(req.user._id, id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/unfollow/:id", [authMiddleware])
  async unfollowCompany(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.unfollowCompany(req.user._id, id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/followers/:id", [authMiddleware])
  async getCompanyFollowers(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }
      const currentUserId = req.user?._id;
      return this.service.getCompanyFollowers(id, currentUserId);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/follow-status/:id", [authMiddleware])
  async getCompanyFollowStatus(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated");
      }
      return this.service.getCompanyFollowStatus(req.user._id, id);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/:id", [authMiddleware])
  async getCompanyById(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      return await this.service.getCompanyByIdWithFollowStatus(
        new ObjectId(id),
        req.user._id,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Put("/verify/:id", [authMiddleware])
  async verifyCompany(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      const body = (await req.json()) as { status: string; notes?: string };
      const { status, notes } = body;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      if (!status || !["verified", "rejected"].includes(status)) {
        return ResponseHelper.error("Invalid verification status");
      }

      return this.service.verifyCompany(
        new ObjectId(id),
        status as "verified" | "rejected",
        notes,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/verification-requests", [authMiddleware, paginationMiddleware])
  async getVerificationRequests(req: RequestWithPagination): Promise<Response> {
    try {
      const { status } = req.query;
      const pagination = req.pagination;

      if (!pagination) {
        return ResponseHelper.error("Pagination manquante");
      }

      const result = await this.service.getVerificationRequests(
        status as string,
        { skip: pagination.skip, limit: pagination.take },
      );

      return autoPaginateResponse(
        req,
        Promise.resolve(result.data),
        Promise.resolve(result.total),
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
