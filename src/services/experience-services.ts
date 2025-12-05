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
import { FileService } from "../utils/file-service";

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
  // Dans experience-services.ts - ajouter cette méthode
  async deleteExperienceWithFiles(
    userId: ObjectId,
    experienceId: ObjectId,
  ): Promise<Response> {
    try {
      // Vérifier que l'expérience appartient à l'utilisateur
      const existingExperience = await this.collection.findOne({
        _id: experienceId,
        userId: userId,
      });

      if (!existingExperience) {
        return ResponseHelper.error("Experience not found or access denied");
      }

      // Supprimer les fichiers de certification associés
      if (
        existingExperience.certificates &&
        existingExperience.certificates.length > 0
      ) {
        const existingCerts =
          await this.certificationRepository.getCertificationsByIds(
            existingExperience.certificates,
          );

        if (existingCerts.length > 0) {
          await FileService.deleteMultipleCertificationFiles(
            existingCerts,
            userId.toString(),
          );
        }

        await this.certificationRepository.deleteCertificationsByIds(
          existingExperience.certificates,
        );
      }

      // Supprimer l'expérience
      await this.deleteById(experienceId);

      // Nettoyer le dossier
      await FileService.cleanEmptyCertificationDirectory(userId.toString());

      return ResponseHelper.success({
        message: "Experience and associated files deleted successfully",
      });
    } catch (err) {
      console.error("❌ Erreur lors de la suppression de l'expérience:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async updateExperience(
    userId: ObjectId,
    experienceId: ObjectId,
    experience: Experience,
    formData: FormData,
  ): Promise<Response> {
    const existingExperience = await this.collection.findOne({
      _id: experienceId,
      userId: userId,
    });

    if (!existingExperience) {
      return ResponseHelper.error("Experience not found or access denied");
    }

    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

    experience._id = experienceId;
    experience.userId = userId;

    // 1. SUPPRESSION DES ANCIENS FICHIERS DE CERTIFICATION
    if (
      existingExperience.certificates &&
      existingExperience.certificates.length > 0
    ) {
      try {
        const existingCerts =
          await this.certificationRepository.getCertificationsByIds(
            existingExperience.certificates,
          );

        if (existingCerts.length > 0) {
          // UTILISATION DE FileService DEPUIS UTILS
          await FileService.deleteMultipleCertificationFiles(
            existingCerts,
            userId.toString(),
          );
        }

        await this.certificationRepository.deleteCertificationsByIds(
          existingExperience.certificates,
        );

        // Nettoyer le dossier si vide
        await FileService.cleanEmptyCertificationDirectory(userId.toString());
      } catch (err) {
        console.error(
          "❌ Erreur lors de la suppression des anciens certificats:",
          err,
        );
        return ResponseHelper.error("Failed to delete old certificates");
      }
    }

    // 2. Initialiser nouveau tableau pour certificats
    experience.certificates = [];

    // 3. Traiter les nouveaux certificats
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

    // Conversion des dates
    if (experience.startDate) {
      experience.startDate = new Date(experience.startDate);
    }
    if (experience.endDate) {
      experience.endDate = new Date(experience.endDate);
    }
    if (experience.currentPost !== undefined) {
      experience.currentPost = Boolean(experience.currentPost);
    }

    // Conserver les autres champs
    experience.KeyAchievements =
      experience.KeyAchievements || existingExperience.KeyAchievements;
    experience.skills = experience.skills || existingExperience.skills;

    await this.experienceRepository.updatedExperience(experience);

    return ResponseHelper.success(experience);
  }
}
