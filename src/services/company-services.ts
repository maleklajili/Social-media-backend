import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Company } from "../models/company";
import { CollectionsManager } from "../models/base/collection-manager";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import type { ICompanyService } from "../interfaces/company/i-company-service";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload } from "../utils/upload-helper";
import { UPLOAD_PATHS } from "../config/config";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { TransactionService } from "./transaction-services";
import { COINS_CONFIG } from "../utils/coins-config";
import { FileService } from "../utils/file-service";

export class CompanyServices
  extends BaseService<Company>
  implements ICompanyService
{
  constructor(
    private companyRepository: ICompanyRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.companyCollection);
  }

  /**
   * Add a new company
   */
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

    // Handle verification documents if requested
    if (
      formData.has("verificationDocuments") &&
      formData.get("requestVerification") === "true"
    ) {
      const docsStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/verification`;
      company.verificationStatus = "pending";

      const docsResult = await handleFileUpload(formData, {
        fieldName: "verificationDocuments",
        storePath: docsStorePath,
        fileName: `doc-${Date.now()}`,
        multiple: true,
        writeToDisk: true,
        userId,
      });

      if (Array.isArray(docsResult) && docsResult.length > 0) {
        company.verificationDocuments = docsResult.map((doc, index) => ({
          file: `${doc.fileName}`,
          type: (formData.get(`documentType${index}`) as string) || "document",
          name:
            (formData.get(`documentName${index}`) as string) ||
            `Document ${index + 1}`,
        }));
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
      console.error("❌ Error adding coins:", err);
    }

    return ResponseHelper.success(company);
  }

  /**
   * Update existing company
   */
  async updateCompany(
    userId: ObjectId,
    companyId: ObjectId,
    company: Company,
    formData: FormData,
  ): Promise<Response> {
    try {
      // Check if company exists and belongs to user
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
        // Delete old cover if exists
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

      // Handle verification documents update
      if (
        formData.has("verificationDocuments") &&
        formData.get("requestVerification") === "true"
      ) {
        const docsStorePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.companies}/verification`;

        // Delete old verification documents if they exist
        if (
          existingCompany.verificationDocuments &&
          existingCompany.verificationDocuments.length > 0
        ) {
          for (const doc of existingCompany.verificationDocuments) {
            await FileService.deleteFile(doc.file);
          }
        }

        const docsResult = await handleFileUpload(formData, {
          fieldName: "verificationDocuments",
          storePath: docsStorePath,
          fileName: `doc-${Date.now()}`,
          multiple: true,
          writeToDisk: true,
          userId,
        });

        if (Array.isArray(docsResult) && docsResult.length > 0) {
          company.verificationDocuments = docsResult.map((doc, index) => ({
            file: `${doc.fileName}`,
            type:
              (formData.get(`documentType${index}`) as string) || "document",
            name:
              (formData.get(`documentName${index}`) as string) ||
              `Document ${index + 1}`,
          }));
          company.verificationStatus = "pending";
        }
      } else {
        company.verificationDocuments = existingCompany.verificationDocuments;
        company.verificationStatus = existingCompany.verificationStatus;
      }

      // Handle documents to delete
      if (formData.has("documentsToDelete")) {
        const docsToDeleteRaw = formData.get("documentsToDelete") as string;
        const docsToDelete: string[] = JSON.parse(docsToDeleteRaw);

        if (
          docsToDelete &&
          docsToDelete.length > 0 &&
          company.verificationDocuments
        ) {
          company.verificationDocuments = company.verificationDocuments.filter(
            (doc) => !docsToDelete.includes(doc.file),
          );

          // Delete files from disk
          for (const docPath of docsToDelete) {
            await FileService.deleteFile(docPath);
          }
        }
      }

      // Keep existing fields if not provided
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

      // Update timestamp
      company.updatedAt = new Date();

      // Update company
      await this.companyRepository.updateCompany(company);

      return ResponseHelper.success(company);
    } catch (err) {
      console.error("❌ Error updating company:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteCompany(
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      // Check if company exists and belongs to user
      const existingCompany = await this.collection.findOne({
        _id: companyId,
        userId,
      });

      if (!existingCompany) {
        return ResponseHelper.error("Company not found or access denied");
      }

      // Remove coins for deleting a company
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
        console.error("❌ Error removing coins:", err);
      }

      // Delete logo and cover images
      if (existingCompany.logo) {
        await FileService.deleteFile(existingCompany.logo);
      }
      if (existingCompany.coverImage) {
        await FileService.deleteFile(existingCompany.coverImage);
      }

      // Delete verification documents
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
      console.error("❌ Error deleting company:", err);
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
}
