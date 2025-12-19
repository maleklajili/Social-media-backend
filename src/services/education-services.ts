import { ObjectId } from "mongodb";
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
import { FileService } from "../utils/file-service";
import type { IUserRepository } from "../interfaces/user/i-user-repository";

export class EducationServices
  extends BaseService<Education>
  implements IEducationService
{
  constructor(
    private educationRepository: IEducationRepository,
    private certificationRepository: ICertificationRepository,
    private userRepository: IUserRepository,
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
    education.userId = userId;
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

    // Normalize data
    education.startDate = new Date(education.startDate);
    if (education.endDate) {
      education.endDate = new Date(education.endDate);
    }
    education.current = String(education.current).toLowerCase() === "true";
    education.featured = String(education.featured).toLowerCase() === "true";

    // Save education
    await this.educationRepository.addEducation(education);
    try {
      await this.userRepository.addCoins(userId, 10);
    } catch (err) {
      return ResponseHelper.serverError(`error add coins ${String(err)}`);
    }

    return ResponseHelper.success(education);
  }

  /**
   * Update existing education with new certificates (optional)
   */
  async updateEducation(
    userId: ObjectId,
    educationId: ObjectId,
    education: Education,
    formData: FormData,
  ): Promise<Response> {
    try {
      // Vérifier que l'éducation existe et appartient à l'utilisateur
      const existingEducation = await this.collection.findOne({
        _id: educationId,
        userId: userId,
      });

      if (!existingEducation) {
        return ResponseHelper.error("Education not found or access denied");
      }

      // Assigner l'ID et l'userId à l'objet education
      education._id = educationId;
      education.userId = userId;

      const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

      // Initialiser avec les certificats existants
      education.certificates = [...(existingEducation.certificates || [])];

      // 1. SUPPRESSION DES CERTIFICATS SÉLECTIONNÉS
      if (formData.has("filesToDelete")) {
        try {
          const filesToDeleteRaw = formData.get("filesToDelete") as string;
          const filesToDelete: string[] = JSON.parse(filesToDeleteRaw);

          if (filesToDelete && filesToDelete.length > 0) {
            // Convertir les IDs string en ObjectId
            const fileIdsToDelete = filesToDelete
              .filter((id) => ObjectId.isValid(id))
              .map((id) => new ObjectId(id));

            if (fileIdsToDelete.length > 0) {
              // Récupérer les certifications à supprimer
              const existingCerts =
                await this.certificationRepository.getCertificationsByIds(
                  fileIdsToDelete,
                );

              if (existingCerts.length > 0) {
                await FileService.deleteMultipleCertificationFiles(
                  existingCerts,
                  userId.toString(),
                );
              }

              await this.certificationRepository.deleteCertificationsByIds(
                fileIdsToDelete,
              );

              // Retirer les IDs des certificats supprimés du tableau
              education.certificates = education.certificates.filter(
                (certId) =>
                  !fileIdsToDelete.some((toDeleteId) =>
                    toDeleteId.equals(certId as ObjectId),
                  ),
              );
            }
          }
        } catch (err) {
          console.error(
            "❌ Erreur lors de la suppression des certificats sélectionnés:",
            err,
          );
          // Continuer même si erreur de suppression
        }
      }

      // 2. AJOUTER LES NOUVEAUX CERTIFICATS
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
              await this.certificationRepository.addCertification(
                certification,
              );
            education.certificates.push(savedCertif._id!);
          }
        }
      }

      // 4. Normaliser les dates et autres champs
      if (education.startDate) {
        education.startDate = new Date(education.startDate);
      } else {
        education.startDate = existingEducation.startDate;
      }

      if (education.endDate) {
        education.endDate = new Date(education.endDate);
      }

      if (education.current !== undefined) {
        education.current = String(education.current).toLowerCase() === "true";
      } else {
        education.current = existingEducation.current;
      }
      if (education.featured !== undefined) {
        education.featured =
          String(education.featured).toLowerCase() === "true";
      } else {
        education.featured = existingEducation.featured;
      }
      // 5. Conserver les champs non fournis
      education.degree = education.degree || existingEducation.degree;
      education.school = education.school || existingEducation.school;
      education.type = education.type || existingEducation.type;
      education.description =
        education.description || existingEducation.description;

      // 6. Mettre à jour l'éducation
      await this.educationRepository.updateEducation(education);

      // 7. Nettoyer le dossier si vide
      await FileService.cleanEmptyCertificationDirectory(userId.toString());

      return ResponseHelper.success(education);
    } catch (err) {
      console.error("❌ Erreur lors de la mise à jour de l'éducation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getEducationsByUserId(userId: ObjectId): Promise<Education[]> {
    return this.educationRepository.getEducationsByUserId(userId);
  }

  async deleteEducationWithFiles(
    userId: ObjectId,
    educationId: ObjectId,
  ): Promise<Response> {
    try {
      // Vérifier que l'éducation appartient à l'utilisateur
      const existingEducation = await this.collection.findOne({
        _id: educationId,
        userId: userId,
      });
      if (!existingEducation) {
        return ResponseHelper.error("Education not found or access denied");
      }
      try {
        await this.userRepository.removeCoins(userId, 10);
      } catch (err) {
        console.error("❌ Erreur lors de la suppression des coins:", err);
        // Ne pas retourner une erreur ici - continuer la suppression
      }

      // Supprimer les fichiers de certification associés
      if (
        existingEducation.certificates &&
        existingEducation.certificates.length > 0
      ) {
        const existingCerts =
          await this.certificationRepository.getCertificationsByIds(
            existingEducation.certificates,
          );

        if (existingCerts.length > 0) {
          await FileService.deleteMultipleCertificationFiles(
            existingCerts,
            userId.toString(),
          );
        }

        await this.certificationRepository.deleteCertificationsByIds(
          existingEducation.certificates,
        );
      }

      // Supprimer l'éducation
      await this.deleteById(educationId);

      await FileService.cleanEmptyCertificationDirectory(userId.toString());

      return ResponseHelper.success({
        message: "Education and associated files deleted successfully",
      });
    } catch (err) {
      console.error("❌ Erreur lors de la suppression de l'éducation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
