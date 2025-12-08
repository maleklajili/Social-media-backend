import type { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Education } from "../models/education";
import { CollectionsManager } from "../models/base/collection-manager";
import type { IEducationRepository } from "../interfaces/education/i-education-repository";
import type { IEducationService } from "../interfaces/education/i-education-service";
import type { ICertificationRepository } from "../interfaces/skill/i-certification-repository";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload } from "../utils/upload-helper";
import { UPLOAD_PATHS } from "../config/config";
import type { Certification } from "../models/certifications";

export class EducationServices
  extends BaseService<Education>
  implements IEducationService
{
  constructor(
    private educationRepository: IEducationRepository,
    private certificationRepository: ICertificationRepository,
  ) {
    super(CollectionsManager.educationCollection);
  }

  /**
   * Add Education with optional certificates upload
   */
  async addEducation(
    userId: ObjectId,
    education: Education,
    formData: FormData,
  ): Promise<Response> {
    // Validation
    if (!education.degree || !education.school || !education.startDate) {
      return ResponseHelper.error("Please complete all required fields.");
    }

    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

    // Handle certificate uploads
    if (formData.has("certificates")) {
      const uploadResults = await handleFileUpload(formData, {
        fieldName: "certificates",
        storePath,
        fileName: new Date().getTime().toString(),
        multiple: true,
        writeToDisk: true,
        userId,
      });

      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        education.certificates = [];
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i];
          const name = `Certification-${education.degree} ${i + 1}`;
          const certification: Certification = {
            userId,
            file: result?.fileName || undefined,
            name,
            type: education.type, // diploma / certification / course
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const savedCertif =
            await this.certificationRepository.addCertification(certification);
          education.certificates.push(savedCertif._id!);
        }
      }
    }

    if (formData.has("skills")) {
      const skillsRaw = formData.get("skills") as string;
      try {
        // Convert JSON string -> ObjectId[]
        education.skills = JSON.parse(skillsRaw) as ObjectId[];
      } catch (err) {
        return ResponseHelper.serverError(
          `Invalid skills format ${String(err)}`,
        );
      }
    }

    // Normalize data
    education.startDate = new Date(education.startDate);
    if (education.endDate) {
      education.endDate = new Date(education.endDate);
    }
    education.current = Boolean(education.current);

    // Save education
    await this.educationRepository.addEducation(education);
    return ResponseHelper.success(education);
  }

  /**
   * Update existing education with new certificates (optional)
   */
  async updateEducation(
    userId: ObjectId,
    education: Education,
    formData: FormData,
  ): Promise<Response> {
    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

    if (formData.has("certificates")) {
      const uploadResults = await handleFileUpload(formData, {
        fieldName: "certificates",
        storePath,
        fileName: new Date().getTime().toString(),
        multiple: true,
        writeToDisk: true,
        userId,
      });

      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        education.certificates = [];
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i];
          const name = `Certification-${education.degree} ${i + 1}`;
          const certification: Certification = {
            userId,
            file: result?.fileName || undefined,
            name,
            type: education.type,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const savedCertif =
            await this.certificationRepository.addCertification(certification);
          education.certificates.push(savedCertif._id!);
        }
      }
    }

    await this.educationRepository.updateEducation(education);
    return ResponseHelper.success(education);
  }

  async getEducationsByUserId(userId: ObjectId): Promise<Education[]> {
    return this.educationRepository.getEducationsByUserId(userId);
  }

  async deleteEducation(id: ObjectId, userId: ObjectId): Promise<boolean> {
    return this.educationRepository.deleteEducation(id, userId);
  }
}
