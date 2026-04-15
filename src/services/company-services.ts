import { ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Company } from "../models/company";
import { CollectionsManager } from "../models/base/collection-manager";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import type { ICompanyService } from "../interfaces/company/i-company-service";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload } from "../utils/upload-helper";
import { UPLOAD_PATHS } from "../config/config";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { IJobRepository } from "../interfaces/job/i-job-repository";
import type { TransactionService } from "./transaction-services";
import { COINS_CONFIG } from "../utils/coins-config";
import { FileService } from "../utils/file-service";
import { NotificationEventHandler } from "./notification-event-handler";

export class CompanyServices
  extends BaseService<Company>
  implements ICompanyService
{
  private notificationHandler: NotificationEventHandler;
  constructor(
    private companyRepository: ICompanyRepository,
    private userRepository: IUserRepository,
    private jobRepository: IJobRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.companyCollection);
    this.notificationHandler = new NotificationEventHandler();
  }
  private viewCache = new Map<string, number>();

  async addCompany(
    userId: ObjectId,
    company: Company,
    formData: FormData,
  ): Promise<Response> {
    // Validation
    if (!company.name || !company.industry || !company.description) {
      return ResponseHelper.error("Please complete all required fields.");
    }

    if (!company.website || !company.location) {
      return ResponseHelper.error("Website and location are required.");
    }

    company.userId = userId;
    company.status = "active";
    company.verified = false;
    company.verificationStatus = "not_requested";

    // ✅ FIX IMPORTANT
    company.createdAt = new Date();
    company.updatedAt = new Date();

    // Initialize stats
    company.stats = {
      views: 0,
      followers: 0,
      jobApplications: 0,
      messages: 0,
    };

    // Handle logo upload
    const logoStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/logo`;
    if (formData.has("logo")) {
      const logoResult = await handleFileUpload(formData, {
        fieldName: "logo",
        storePath: logoStorePath,
        fileName: `logo-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId,
      });

      if (logoResult && !Array.isArray(logoResult) && logoResult.fileName) {
        company.logo = `${logoResult.fileName}`;
      }
    }

    // Handle cover image upload
    const coverStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/cover`;
    if (formData.has("coverImage")) {
      const coverResult = await handleFileUpload(formData, {
        fieldName: "coverImage",
        storePath: coverStorePath,
        fileName: `cover-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId,
      });

      if (coverResult && !Array.isArray(coverResult) && coverResult.fileName) {
        company.coverImage = `${coverResult.fileName}`;
      }
    }

    // Save company
    await this.companyRepository.addCompany(company);

    return ResponseHelper.success(company);
  }

  async updateCompany(
    userId: ObjectId,
    companyId: ObjectId,
    company: Company,
    formData: FormData,
  ): Promise<Response> {
    try {
      const existingCompany = await this.collection.findOne({
        _id: companyId,
        userId,
      });

      if (!existingCompany) {
        return ResponseHelper.error("Company not found or access denied");
      }

      company._id = companyId;
      company.userId = userId;

      company.stats = existingCompany.stats;

      // KEEP OLD createdAt (IMPORTANT FIX)
      company.createdAt = existingCompany.createdAt;
      company.updatedAt = new Date();

      // Handle logo
      const logoStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/logo`;
      if (formData.has("logo")) {
        if (existingCompany.logo) {
          await FileService.deleteFile(existingCompany.logo);
        }

        const logoResult = await handleFileUpload(formData, {
          fieldName: "logo",
          storePath: logoStorePath,
          fileName: `logo-${Date.now()}`,
          multiple: false,
          writeToDisk: true,
          userId,
        });

        if (logoResult && !Array.isArray(logoResult) && logoResult.fileName) {
          company.logo = `${logoResult.fileName}`;
        }
      } else {
        company.logo = existingCompany.logo;
      }

      // Handle cover image
      const coverStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/cover`;
      if (formData.has("coverImage")) {
        if (existingCompany.coverImage) {
          await FileService.deleteFile(existingCompany.coverImage);
        }

        const coverResult = await handleFileUpload(formData, {
          fieldName: "coverImage",
          storePath: coverStorePath,
          fileName: `cover-${Date.now()}`,
          multiple: false,
          writeToDisk: true,
          userId,
        });

        if (
          coverResult &&
          !Array.isArray(coverResult) &&
          coverResult.fileName
        ) {
          company.coverImage = `${coverResult.fileName}`;
        }
      } else {
        company.coverImage = existingCompany.coverImage;
      }

      // KEEP OLD DATA SAFE
      if (!company.name) company.name = existingCompany.name;
      if (!company.industry) company.industry = existingCompany.industry;
      if (!company.description)
        company.description = existingCompany.description;

      company.updatedAt = new Date();

      await this.companyRepository.updateCompany(company);

      return ResponseHelper.success(company);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteCompany(
    currentUserId: ObjectId,
    companyId: ObjectId,
    isAdmin: boolean,
  ): Promise<Response> {
    try {
      const existingCompany = await this.collection.findOne({
        _id: companyId,
      });

      if (!existingCompany) {
        return ResponseHelper.error("Company not found");
      }

      const isOwner = existingCompany.userId.equals(currentUserId);
      if (!isOwner && !isAdmin) {
        return ResponseHelper.error(
          "Access denied: you are not the owner or admin",
        );
      }

      try {
        await this.userRepository.removeCoins(
          existingCompany.userId,
          COINS_CONFIG.REMOVE_COMPANY,
        );
        await this.transactionService.addStandardSpending(
          existingCompany.userId,
          "company",
          companyId,
          `Suppression d'une page entreprise par ${isAdmin ? "admin" : "propriétaire"}`,
          COINS_CONFIG.REMOVE_COMPANY,
        );
      } catch (err) {
        console.error(" Error removing coins:", err);
      }

      // 4. Supprimer les fichiers associés (logo, cover, documents)
      if (existingCompany.logo) {
        await FileService.deleteFile(existingCompany.logo);
      }
      if (existingCompany.coverImage) {
        await FileService.deleteFile(existingCompany.coverImage);
      }
      if (existingCompany.verificationDocuments?.length) {
        for (const doc of existingCompany.verificationDocuments) {
          await FileService.deleteFile(doc.file);
        }
      }

      // 5. Supprimer l'entreprise de la base
      await this.companyRepository.deleteCompany(
        companyId,
        existingCompany.userId,
      );

      return ResponseHelper.success({
        message: "Company and associated files deleted successfully",
      });
    } catch (err) {
      console.error(" Error deleting company:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompaniesByUserId(userId: ObjectId): Promise<Response> {
    try {
      const companies =
        await this.companyRepository.getCompaniesByUserId(userId);
      return ResponseHelper.success(companies);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompanyById(companyId: ObjectId): Promise<Response> {
    try {
      const company = await this.companyRepository.getCompanyById(companyId);
      if (!company) {
        return ResponseHelper.error("Company not found");
      }
      return ResponseHelper.success(company);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompanyByIdWithFollowStatus(
    companyId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const cacheKey = `${userId.toString()}-${companyId.toString()}`;
      const lastView = this.viewCache.get(cacheKey);
      const now = Date.now();

      if (!lastView || now - lastView > 10000) {
        await this.companyRepository.incrementViews(companyId);
        this.viewCache.set(cacheKey, now);
      }

      const company = await this.companyRepository.getCompanyById(companyId);
      if (!company) {
        return ResponseHelper.error("Company not found");
      }

      const isFollowing = await this.companyRepository.isFollowing(
        userId,
        companyId,
      );

      const companyWithFollow = {
        ...company,
        following: isFollowing,
      };
      return ResponseHelper.success(companyWithFollow);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  async incrementCompanyViews(companyId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      { $inc: { "stats.views": 1 } },
    );
  }

  async getAggregatedStats(): Promise<{
    totalCompanies: number;
    totalJobs: number;
    totalLocations: number;
    totalIndustries: number;
  }> {
    const [totalCompanies, totalJobs, totalLocations, totalIndustries] =
      await Promise.all([
        this.companyRepository.countCompanies(),
        this.jobRepository.countJobs(),
        this.companyRepository.countDistinctLocations(),
        this.companyRepository.countDistinctIndustries(),
      ]);

    return { totalCompanies, totalJobs, totalLocations, totalIndustries };
  }

  async followCompany(
    currentUserId: ObjectId,
    companyId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID format", 400);
      }

      const targetId = new ObjectId(companyId);

      const company = await this.companyRepository.getCompanyById(targetId);
      if (!company) {
        return ResponseHelper.error("Company not found", 404);
      }

      const isAlreadyFollowing = await this.companyRepository.isFollowing(
        currentUserId,
        targetId,
      );
      if (isAlreadyFollowing) {
        return ResponseHelper.error(
          "You are already following this company",
          400,
        );
      }

      await this.companyRepository.followCompany(currentUserId, targetId);
      await this.userRepository.followCompany(currentUserId, targetId);

      try {
        const follower = await this.userRepository.findById(currentUserId, 0);
        const followerName =
          follower?.userName || follower?.firstName || "Quelqu'un";

        await this.notificationHandler.handleCompanyFollow(
          currentUserId,
          company.userId,
          targetId,
          company.name,
          followerName,
        );
      } catch (err) {
        console.error("Error sending company follow notification:", err);
      }
      const followerCount =
        await this.companyRepository.getFollowCount(targetId);

      return ResponseHelper.success({
        message: "Company followed successfully",
        following: true,
        followerCount,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async unfollowCompany(
    currentUserId: ObjectId,
    companyId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID format", 400);
      }

      const targetId = new ObjectId(companyId);

      const company = await this.companyRepository.getCompanyById(targetId);
      if (!company) {
        return ResponseHelper.error("Company not found", 404);
      }

      const isFollowing = await this.companyRepository.isFollowing(
        currentUserId,
        targetId,
      );
      if (!isFollowing) {
        return ResponseHelper.error("You are not following this company", 400);
      }

      await this.companyRepository.unfollowCompany(currentUserId, targetId);
      await this.userRepository.unfollowCompany(currentUserId, targetId);

      const followerCount =
        await this.companyRepository.getFollowCount(targetId);

      return ResponseHelper.success({
        message: "Company unfollowed successfully",
        following: false,
        followerCount,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getAllCompaniesWithFollowStatus(
    userId: ObjectId,
    filter: Filter<Company>,
    pagination: { skip: number; limit: number },
  ): Promise<{ data: Company[]; total: number }> {
    const companies = await this.collection
      .find(filter)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray();

    const total = await this.collection.countDocuments(filter);

    const companiesWithFollow = await Promise.all(
      companies.map(async (company) => {
        const isFollowing = await this.companyRepository.isFollowing(
          userId,
          company._id!,
        );
        return {
          ...company,
          following: isFollowing,
        };
      }),
    );

    return { data: companiesWithFollow, total };
  }

  async getCompanyFollowers(
    companyId: string,
    currentUserId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID format", 400);
      }

      const targetId = new ObjectId(companyId);

      // Récupérer les IDs des abonnés
      const followerIds = await this.companyRepository.getFollowers(targetId);

      if (followerIds.length === 0) {
        return ResponseHelper.success([]);
      }

      const followers = await this.userRepository.findByIds(followerIds);

      if (currentUserId) {
        const followersWithStatus = await Promise.all(
          followers.map(async (follower) => {
            const isFollowing = await this.userRepository.isFollowing(
              currentUserId,
              follower._id as ObjectId,
            );
            return {
              ...follower,
              isFollowedByCurrentUser: isFollowing,
            };
          }),
        );
        return ResponseHelper.success(followersWithStatus);
      }

      return ResponseHelper.success(followers);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCompanyFollowStatus(
    currentUserId: ObjectId,
    companyId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(companyId)) {
        return ResponseHelper.error("Invalid company ID format", 400);
      }

      const targetId = new ObjectId(companyId);

      const isFollowing = await this.companyRepository.isFollowing(
        currentUserId,
        targetId,
      );
      const followerCount =
        await this.companyRepository.getFollowCount(targetId);

      return ResponseHelper.success({
        isFollowing,
        followerCount,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async verifyCompany(
    companyId: ObjectId,
    status: "verified" | "rejected",
    notes?: string,
  ): Promise<Response> {
    try {
      const company = await this.companyRepository.getCompanyById(companyId);

      if (!company) {
        return ResponseHelper.error("Company not found");
      }

      const updateData: Partial<Company> = {
        verificationStatus: status,
        updatedAt: new Date(),
        adminResponse:
          notes ||
          (status === "verified"
            ? "Félicitations ! Votre entreprise a été vérifiée avec succès."
            : "Nous vous remercions pour votre demande. Malheureusement, les documents fournis ne sont pas suffisants pour valider votre entreprise."),
        adminResponseDate: new Date(),
      };

      if (status === "verified") {
        updateData.verified = true;
      } else {
        updateData.verified = false;
      }

      await this.companyRepository.updateCompany({
        ...company,
        ...updateData,
      } as Company);

      // Send notification to company owner
      try {
        const companyName = company.name;
        await this.notificationHandler.handleCompanyVerification(
          company.userId,
          companyId,
          companyName,
          status,
          updateData.adminResponse,
        );
      } catch (err) {
        console.error("Error sending verification notification:", err);
      }

      return ResponseHelper.success({
        message: `Company ${status === "verified" ? "verified" : "rejected"} successfully`,
        verificationStatus: status,
        adminResponse: updateData.adminResponse,
      });
    } catch (err) {
      console.error(" Error verifying company:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getVerificationRequests(
    status?: string,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: Company[]; total: number }> {
    const filter: Filter<Company> = {};

    if (status && status !== "all") {
      filter.verificationStatus = status as "pending" | "verified" | "rejected";
    } else {
      filter.verificationStatus = { $in: ["pending", "verified", "rejected"] };
    }

    const skip = pagination?.skip || 0;
    const limit = pagination?.limit || 20;

    const companies = await this.collection
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await this.collection.countDocuments(filter);

    // Fetch user info for each company
    const companiesWithUserInfo = await Promise.all(
      companies.map(async (company) => {
        const user = await this.userRepository.findById(company.userId, 0);
        return {
          ...company,
          user: user
            ? {
                _id: user._id,
                userName: user.userName,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              }
            : null,
        };
      }),
    );

    return { data: companiesWithUserInfo, total };
  }
}
