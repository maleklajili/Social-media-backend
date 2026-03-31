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
    for (const key of formData.keys()) {
      const value = formData.get(key);
      if (value instanceof File) {
        console.log(
          `- ${key}: FILE (${value.name}, ${value.size} bytes, ${value.type})`,
        );
      } else {
        console.log(`- ${key}: ${value}`);
      }
    }

    const documentsCount = parseInt(
      (formData.get("verificationDocumentsCount") as string) || "0",
    );

    if (documentsCount > 0) {
      const docsStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/verification`;
      company.verificationStatus = "pending";

      const verificationDocuments = [];

      for (let i = 0; i < documentsCount; i++) {
        let file = formData.get(`verificationDocument_${i}`) as File;
        if (!file || !(file instanceof File)) {
          file = formData.get(`verificationDocuments_${i}`) as File;
        }
        if (!file || !(file instanceof File)) {
          file = formData.get(`document_${i}`) as File;
        }

        const docType = formData.get(`documentType_${i}`) as string;
        const docName = formData.get(`documentName_${i}`) as string;

        if (file && file instanceof File && file.size > 0) {
          const tempFormData = new FormData();
          tempFormData.append("file", file);

          const uploadResult = await handleFileUpload(tempFormData, {
            fieldName: "file",
            storePath: docsStorePath,
            fileName: `doc-${Date.now()}-${i}`,
            multiple: false,
            writeToDisk: true,
            userId,
          });

          if (
            uploadResult &&
            !Array.isArray(uploadResult) &&
            uploadResult.fileName
          ) {
            verificationDocuments.push({
              file: uploadResult.fileName,
              type: docType || "document",
              name: docName || `Document ${i + 1}`,
            });
            console.log(` ADD Document uploadé: ${uploadResult.fileName}`);
          } else {
            console.log(` Échec upload document ${i}`);
          }
        } else {
          console.log(` ADD Document ${i} invalide ou vide`);
        }
      }

      if (verificationDocuments.length > 0) {
        company.verificationDocuments = verificationDocuments;
        console.log(
          `📁 ${verificationDocuments.length} documents de vérification sauvegardés pour la nouvelle entreprise`,
        );
      } else {
        console.log(`⚠️ Aucun document valide trouvé, statut inchangé`);
        company.verificationStatus = "not_requested";
      }
    }

    // Save company
    await this.companyRepository.addCompany(company);

    // Add coins for creating a company
    try {
      await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_COMPANY);
      await this.transactionService.addStandardEarning(
        userId,
        COINS_CONFIG.ADD_COMPANY,
        "company",
        company._id!,
        `Création d'une page entreprise`,
        {
          name: company.name,
          industry: company.industry,
          verificationStatus: company.verificationStatus,
        },
      );
    } catch (err) {
      console.error(" Error adding coins:", err);
    }

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

      // Assign ID and userId
      company._id = companyId;
      company.userId = userId;

      // Keep existing stats
      company.stats = existingCompany.stats;

      // Handle logo update
      const logoStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/logo`;
      if (formData.has("logo")) {
        // Delete old logo if exists
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

      // Handle cover image update
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

      const keys: string[] = [];
      for (const key of formData.keys()) {
        keys.push(key);
        const value = formData.get(key);
        if (value instanceof File) {
          console.log(`- ${key}: FILE (${value.name})`);
        } else {
          console.log(`- ${key}: ${value}`);
        }
      }

      const documentsCount = parseInt(
        (formData.get("verificationDocumentsCount") as string) || "0",
      );

      if (documentsCount > 0) {
        const docsStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/verification`;

        if (
          existingCompany.verificationDocuments &&
          existingCompany.verificationDocuments.length > 0
        ) {
          for (const doc of existingCompany.verificationDocuments) {
            await FileService.deleteFile(doc.file);
          }
        }

        const verificationDocuments = [];

        for (let i = 0; i < documentsCount; i++) {
          let file = formData.get(`verificationDocument_${i}`) as File;
          if (!file || !(file instanceof File)) {
            file = formData.get(`verificationDocuments_${i}`) as File;
          }
          if (!file || !(file instanceof File)) {
            file = formData.get(`document_${i}`) as File;
          }

          const docType = formData.get(`documentType_${i}`) as string;
          const docName = formData.get(`documentName_${i}`) as string;

          if (file && file instanceof File && file.size > 0) {
            const tempFormData = new FormData();
            tempFormData.append("file", file);

            const uploadResult = await handleFileUpload(tempFormData, {
              fieldName: "file",
              storePath: docsStorePath,
              fileName: `doc-${Date.now()}-${i}`,
              multiple: false,
              writeToDisk: true,
              userId,
            });

            if (
              uploadResult &&
              !Array.isArray(uploadResult) &&
              uploadResult.fileName
            ) {
              verificationDocuments.push({
                file: uploadResult.fileName,
                type: docType || "document",
                name: docName || `Document ${i + 1}`,
              });
              console.log(`Update Document uploadé: ${uploadResult.fileName}`);
            } else {
              console.log(` Échec upload document ${i}`);
            }
          } else {
            console.log(`Document ${i} invalide ou vide`);
          }
        }

        if (verificationDocuments.length > 0) {
          company.verificationDocuments = verificationDocuments;
          company.verificationStatus = "pending";
          console.log(
            ` ${verificationDocuments.length} nouveaux documents de vérification sauvegardés`,
          );
        } else {
          company.verificationDocuments = existingCompany.verificationDocuments;
          company.verificationStatus = existingCompany.verificationStatus;
        }
      } else {
        company.verificationDocuments = existingCompany.verificationDocuments;
        company.verificationStatus = existingCompany.verificationStatus;
      }

      if (formData.has("filesToDelete")) {
        const filesToDeleteRaw = formData.get("filesToDelete") as string;
        const filesToDelete: string[] = JSON.parse(filesToDeleteRaw);

        if (
          filesToDelete &&
          filesToDelete.length > 0 &&
          company.verificationDocuments
        ) {
          company.verificationDocuments = company.verificationDocuments.filter(
            (doc) => !filesToDelete.includes(doc.file),
          );

          for (const docPath of filesToDelete) {
            await FileService.deleteFile(docPath);
          }
        }
      }

      if (!company.name) company.name = existingCompany.name;
      if (!company.industry) company.industry = existingCompany.industry;
      if (!company.description)
        company.description = existingCompany.description;
      if (!company.shortDescription)
        company.shortDescription = existingCompany.shortDescription;
      if (!company.website) company.website = existingCompany.website;
      if (!company.foundedYear)
        company.foundedYear = existingCompany.foundedYear;
      if (!company.size) company.size = existingCompany.size;
      if (!company.location) company.location = existingCompany.location;
      if (!company.address) company.address = existingCompany.address;
      if (!company.phone) company.phone = existingCompany.phone;
      if (!company.email) company.email = existingCompany.email;
      if (!company.socialMedia)
        company.socialMedia = existingCompany.socialMedia;
      if (!company.keywords) company.keywords = existingCompany.keywords;
      if (!company.status) company.status = existingCompany.status;
      if (!company.verified) company.verified = existingCompany.verified;
      if (!company.verificationNotes)
        company.verificationNotes = existingCompany.verificationNotes;

      company.updatedAt = new Date();

      // Update company in database
      await this.companyRepository.updateCompany(company);

      return ResponseHelper.success(company);
    } catch (err) {
      console.error(" Error updating company:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteCompany(
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      const existingCompany = await this.collection.findOne({
        _id: companyId,
        userId,
      });

      if (!existingCompany) {
        return ResponseHelper.error("Company not found or access denied");
      }

      try {
        await this.userRepository.removeCoins(
          userId,
          COINS_CONFIG.REMOVE_COMPANY,
        );
        await this.transactionService.addStandardSpending(
          userId,
          "company",
          companyId,
          `Suppression d'une page entreprise`,
          COINS_CONFIG.REMOVE_COMPANY,
        );
      } catch (err) {
        console.error(" Error removing coins:", err);
      }

      // Delete logo and cover images
      if (existingCompany.logo) {
        await FileService.deleteFile(existingCompany.logo);
      }
      if (existingCompany.coverImage) {
        await FileService.deleteFile(existingCompany.coverImage);
      }

      if (
        existingCompany.verificationDocuments &&
        existingCompany.verificationDocuments.length > 0
      ) {
        for (const doc of existingCompany.verificationDocuments) {
          await FileService.deleteFile(doc.file);
        }
      }

      // Delete company from database
      await this.companyRepository.deleteCompany(companyId, userId);

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
