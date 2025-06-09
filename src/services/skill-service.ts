import { ObjectId } from "mongodb";
import { UPLOAD_PATHS } from "../config/config";
import type { ICertificationRepository } from "../interfaces/skill/i-certification-repository";
import type { ISkillRepository } from "../interfaces/skill/i-skill-repository";
import type { ISkillService } from "../interfaces/skill/i-skill-service";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Certification } from "../models/certifications";
import { type Skill } from "../models/skill";
import { ResponseHelper } from "../utils/response-helper";
import { deleteFiles, handleFileUpload } from "../utils/upload-helper";
import { BaseService } from "./base/base-service";

export class SkillService extends BaseService<Skill> implements ISkillService {
  constructor(
    private skillRepository: ISkillRepository,
    private userRepository: IUserRepository,
    private certificationRepository: ICertificationRepository,
  ) {
    super(CollectionsManager.skillCollection);
  }
  async createOneSkill(
    skill: Skill,
    formData: FormData,
    certifNames: string[],
  ): Promise<Response> {
    if (!ObjectId.isValid(skill.userId)) {
      return ResponseHelper.success("userId is invalid");
    }

    const userId = new ObjectId(String(skill.userId));
    const user = await this.userRepository.findById(userId, 0);
    if (!user) {
      return ResponseHelper.success("User not found");
    }

    if (!skill.name || !skill.level) {
      return ResponseHelper.success("Name and level are required");
    }

    const existingSkill = await this.skillRepository.findByName(skill.name);
    if (existingSkill) {
      return ResponseHelper.error("Skill already exists");
    }

    skill.certifications = [];

    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;

    // Handle multiple file uploads
    const uploadResults = await handleFileUpload(formData, {
      fieldName: "certifications",
      storePath,
      fileName: new Date().getTime().toString(),
      multiple: true,
      writeToDisk: true,
      userId: userId,
    });

    if (Array.isArray(uploadResults) && uploadResults.length > 0) {
      for (let i = 0; i < uploadResults.length; i++) {
        const result = uploadResults[i];
        const name = certifNames[i] || `Certification ${i + 1}`;

        const certification: Certification = {
          userId: userId,
          file: result?.fileName || undefined,
          name: name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const savedCertif =
          await this.certificationRepository.addCertification(certification);
        skill.certifications.push(savedCertif._id!);
      }
    }

    await this.skillRepository.createSkill(skill);
    return ResponseHelper.success(skill);
  }

  async createManySkills(
    skills: Skill[],
    formData: FormData,
    certifNamesList: string[][],
  ): Promise<Response> {
    const allCreatedSkills: Skill[] = [];

    // Check for duplicate skill names in the input array
    const nameCounts = new Map<string, number>();
    for (const skill of skills) {
      if (!skill?.name) continue;
      const lowerName = skill.name.toLowerCase(); // case-insensitive
      nameCounts.set(lowerName, (nameCounts.get(lowerName) || 0) + 1);
    }

    const duplicates = Array.from(nameCounts.entries()).filter(
      ([, count]) => count > 1,
    );
    if (duplicates.length > 0) {
      const duplicatedNames = duplicates.map(([name]) => name).join(", ");
      return ResponseHelper.error(
        `Duplicate skill names in request: ${duplicatedNames}`,
      );
    }

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const certifNames = certifNamesList[i] || [];

      if (!skill) {
        return ResponseHelper.error(`Skill at index ${i} is missing`);
      }

      if (!ObjectId.isValid(skill.userId)) {
        return ResponseHelper.error(`Invalid userId for skill ${skill.name}`);
      }

      const userId = new ObjectId(String(skill.userId));
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error(`User not found for skill ${skill.name}`);
      }

      if (
        !skill?.name ||
        !skill?.categorie ||
        !skill?.level ||
        !skill?.sousCategorie
      ) {
        return ResponseHelper.error(
          "The fields name, categorie, level, and sousCategorie are required.",
        );
      }

      const existingSkill = await this.skillRepository.findByName(skill.name);
      if (existingSkill) {
        return ResponseHelper.error(`Skill "${skill.name}" already exists`);
      }

      skill.certifications = [];

      const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;
      const fieldName = `skills[${i}][certifications]`;

      const uploadResults = await handleFileUpload(formData, {
        fieldName,
        storePath,
        fileName: new Date().getTime().toString(),
        multiple: true,
        writeToDisk: true,
        userId: userId,
      });

      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        for (let j = 0; j < uploadResults.length; j++) {
          const result = uploadResults[j];
          const name = certifNames[j] || `Certification ${j + 1}`;

          const certification: Certification = {
            userId: userId,
            file: result?.fileName || undefined,
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const savedCertif =
            await this.certificationRepository.addCertification(certification);
          skill.certifications.push(savedCertif._id!);
        }
      }

      allCreatedSkills.push(skill);
    }

    await this.skillRepository.createManySkills(allCreatedSkills);

    return ResponseHelper.success(allCreatedSkills);
  }

  async updateManySkills(
    currentUserId: ObjectId,
    skills: Skill[],
    formData: FormData,
    certifNamesList: string[][],
  ): Promise<Response> {
    const updatedSkills: Skill[] = [];

    const nameCounts = new Map<string, number>();
    for (const skill of skills) {
      if (!skill?.name) continue;
      const lowerName = skill.name.toLowerCase();
      nameCounts.set(lowerName, (nameCounts.get(lowerName) || 0) + 1);
    }

    const duplicates = Array.from(nameCounts.entries()).filter(
      ([, count]) => count > 1,
    );
    if (duplicates.length > 0) {
      const duplicatedNames = duplicates.map(([name]) => name).join(", ");
      return ResponseHelper.error(
        `Duplicate skill names in request: ${duplicatedNames}`,
      );
    }

    for (let i = 0; i < skills.length; i++) {
      const skillUpdate = skills[i];
      const certifNames = certifNamesList[i] || [];

      // Ensure userId is valid
      if (skillUpdate?.userId && !ObjectId.isValid(skillUpdate.userId)) {
        return ResponseHelper.error(
          `Invalid userId for skill "${skillUpdate.name}"`,
        );
      }

      const userId = new ObjectId(String(skillUpdate?.userId));
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error(
          `User not found for skill "${skillUpdate?.name}"`,
        );
      }

      const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.cerifications}`;
      const fieldName = `skills[${i}][certifications]`;

      let existingSkill = null;
      if (skillUpdate?._id && ObjectId.isValid(String(skillUpdate?._id))) {
        existingSkill = await this.skillRepository.findById(skillUpdate._id);
      }

      if (
        existingSkill &&
        Array.isArray(existingSkill.certifications) &&
        existingSkill.certifications.length > 0
      ) {
        for (const certifId of existingSkill.certifications) {
          const certifcation =
            await this.certificationRepository.findById(certifId);
          await deleteFiles(certifcation?.file, storePath, userId);
          await this.certificationRepository.deleteOne(certifId);
        }
      }

      if (
        !skillUpdate?.name ||
        !skillUpdate?.categorie ||
        !skillUpdate?.level ||
        !skillUpdate?.sousCategorie
      ) {
        return ResponseHelper.error(
          "The fields name, categorie, level, and sousCategorie are required.",
        );
      }

      const updatedSkill: Skill = {
        _id: skillUpdate?._id,
        userId,
        // Classification
        categorie: skillUpdate.categorie,
        sousCategorie: skillUpdate.sousCategorie,

        // Core skill Details
        name: skillUpdate.name,
        level: skillUpdate.level,
        description: skillUpdate.description,
        color: skillUpdate.color,

        // Metrics
        experienceNumber: skillUpdate.experienceNumber,
        projectNumber: skillUpdate.projectNumber,
        percentage: skillUpdate.percentage,

        // Certifications
        certifications: [],
        certifed: skillUpdate.certifed,

        // Flags
        favorite: skillUpdate.favorite,
        apprenticeship: skillUpdate.apprenticeship,

        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (formData.has(fieldName)) {
        const uploadResults = await handleFileUpload(formData, {
          fieldName,
          storePath,
          fileName: new Date().getTime().toString(),
          multiple: true,
          writeToDisk: true,
          userId,
        });

        if (Array.isArray(uploadResults) && uploadResults.length > 0) {
          for (let j = 0; j < uploadResults.length; j++) {
            const result = uploadResults[j];
            const name = certifNames[j] || `Certification ${j + 1}`;

            const certification: Certification = {
              userId,
              file: result?.fileName || undefined,
              name,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const savedCertif =
              await this.certificationRepository.addCertification(
                certification,
              );
            if (!updatedSkill.certifications) {
              updatedSkill.certifications = [];
            }
            updatedSkill.certifications.push(savedCertif._id!);
          }
        } else {
          updatedSkill.certifications = [];
        }
      } else if (existingSkill) {
        updatedSkill.certifications = existingSkill.certifications;
      }

      updatedSkills.push(updatedSkill);
    }

    await this.skillRepository.updateMany(currentUserId, updatedSkills);

    return ResponseHelper.success(updatedSkills);
  }
}
