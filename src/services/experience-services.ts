import type { ObjectId } from "mongodb";
import { UPLOAD_PATHS } from "../config/config";
import type { IExerienceRepository } from "../interfaces/experience/i-experience-repository";
import type { IExperienceService } from "../interfaces/experience/i-experience-service";
import type { ICertificationRepository } from "../interfaces/skill/i-certification-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Certification } from "../models/certifications";
import type { Experience } from "../models/experience";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload } from "../utils/upload-helper";
import { BaseService } from "./base/base-service";

export class ExperienceServices
  extends BaseService<Experience>
  implements IExperienceService
{
  constructor(
    private experienceRepository: IExerienceRepository,
    private certificationRepository: ICertificationRepository,
  ) {
    super(CollectionsManager.experienceCollection);
  }

  async addExperience(
    userId: ObjectId,
    experience: Experience,
    formData: FormData,
  ): Promise<Response> {
    if (
      !experience.place ||
      !experience.post ||
      !experience.entreprise ||
      !experience.startDate
    ) {
      return ResponseHelper.error("complete all");
    }

    experience.userId = userId;

    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

    if (formData.has("certificates")) {
      const uploadResults = await handleFileUpload(formData, {
        fieldName: "certificates",
        storePath,
        fileName: new Date().getTime().toString(),
        multiple: true,
        writeToDisk: true,
        userId: userId,
      });

      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        experience.certificates = [];
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i];
          const name = `Certification-${experience.post} ${i + 1}`;

          const certification: Certification = {
            userId: userId,
            file: result?.fileName || undefined,
            name: name,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const savedCertif =
            await this.certificationRepository.addCertification(certification);
          experience.certificates.push(savedCertif._id!);
        }
      }
    }
    experience.startDate = new Date(experience.startDate);
    experience.endDate = new Date(experience.endDate);
    experience.currentPost = Boolean(experience.currentPost);
    await this.experienceRepository.addExperience(experience);

    return ResponseHelper.success(experience);
  }

  async updateExperience(
    userId: ObjectId,
    experience: Experience,
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
        userId: userId,
      });

      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        experience.certificates = []; // Replace old certificates
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i];
          const name = `Certification-${experience.post} ${i + 1}`;

          const certification: Certification = {
            userId: userId,
            file: result?.fileName || undefined,
            name: name,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const savedCertif =
            await this.certificationRepository.addCertification(certification);
          experience.certificates.push(savedCertif._id!);
        }
      }
    }

    await this.experienceRepository.updatedExperience(experience);

    return ResponseHelper.success(experience);
  }
}
