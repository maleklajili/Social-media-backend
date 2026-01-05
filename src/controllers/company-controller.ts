import { Collection, ObjectId } from "mongodb";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import type { ServerRequest } from "../config/interfaces/i-request";
import { authMiddleware } from "../middleware/aut-middleware";
import { paginationMiddleware } from "../middleware/pagination-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Company } from "../models/company";
import { Delete, Get, Post, Put } from "../routes/router-manager";
import { CompanyServices } from "../services/company-services";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { CompanyRepository } from "../repositories/company-repository";
import { userRepository } from "../repositories/user-repository";
import { TransactionService } from "../services/transaction-services";
import { TransactionRepository } from "../repositories/transaction-repository";

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
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  @Get("/getAll", [authMiddleware, paginationMiddleware])
  async getAll(req: RequestWithPagination): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: Record<string, any> = { userId: req.user._id };

      if (req.query?.status) {
        filter.status = req.query.status;
      }

      if (req.query?.verified !== undefined) {
        const verifiedValue = req.query.verified === "true";
        filter.verified = verifiedValue;
      }

      return super.getAll(req, [], filter);
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

      return this.service.deleteCompany(req.user._id, new ObjectId(id));
    } catch (err) {
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

  @Get("/:id", [authMiddleware])
  async getCompanyById(req: ServerRequest): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id || !ObjectId.isValid(id)) {
        return ResponseHelper.error("Invalid or missing company id");
      }

      return this.service.getCompanyById(new ObjectId(id));
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
