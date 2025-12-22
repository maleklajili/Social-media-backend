// src/services/skills/technical-skill-service.ts
import { ObjectId } from "mongodb";
import { BaseService } from "../base/base-service";
import type { TechnicalSkill } from "../../models/skills/technical-skill";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { ITechnicalSkillRepository } from "../../interfaces/skills/i-technical-skill-repository";
import type { ITechnicalSkillService } from "../../interfaces/skills/i-technical-skill-service";
import { ResponseHelper } from "../../utils/response-helper";
import type { IUserRepository } from "../../interfaces/user/i-user-repository";
import { COINS_CONFIG } from "../../utils/coins-config";

export class TechnicalSkillService
  extends BaseService<TechnicalSkill>
  implements ITechnicalSkillService
{
  constructor(
    private technicalSkillRepository: ITechnicalSkillRepository,
    private userRepository: IUserRepository,
  ) {
    super(CollectionsManager.technicalSkillCollection);
  }

  async getTechnicalSkillsByUser(userId: ObjectId): Promise<Response> {
    try {
      const skills =
        await this.technicalSkillRepository.getTechnicalSkillsByUserId(userId);
      return ResponseHelper.success(skills);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async addTechnicalSkill(
    userId: ObjectId,
    skillData: Partial<TechnicalSkill>,
  ): Promise<Response> {
    try {
      // Validation minimale
      if (!skillData.name || !skillData.category) {
        return ResponseHelper.error("Nom et catégorie sont requis");
      }

      const skill: TechnicalSkill = {
        userId,
        name: skillData.name,
        category: skillData.category,
        subcategory: skillData.subcategory || undefined,
        level: skillData.level ?? 50,
        certified: skillData.certified ?? false,
        color: skillData.color,
        description: skillData.description,
        yearsOfExperience: skillData.yearsOfExperience ?? 0,
        projectsCount: skillData.projectsCount ?? 0,
        isFavorite: skillData.isFavorite ?? false,
        isInLearning: skillData.isInLearning ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdSkill =
        await this.technicalSkillRepository.addTechnicalSkill(skill);

      // Ajout de coins (optionnel)
      try {
        await this.userRepository.addCoins(
          userId,
          COINS_CONFIG.ADD_SKILL || 15,
        );
      } catch (coinErr) {
        console.error("Erreur lors de l'ajout de coins:", coinErr);
        // On continue quand même
      }

      return ResponseHelper.success(createdSkill);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateTechnicalSkill(
    userId: ObjectId,
    skillId: ObjectId,
    skillData: Partial<TechnicalSkill>,
  ): Promise<Response> {
    try {
      const existing =
        await this.technicalSkillRepository.getTechnicalSkillById(skillId);
      if (!existing || !existing.userId.equals(userId)) {
        return ResponseHelper.error("Compétence non trouvée ou accès refusé");
      }

      const updated = await this.technicalSkillRepository.updateTechnicalSkill(
        skillId,
        skillData,
      );
      if (!updated) {
        return ResponseHelper.error("Échec de la mise à jour");
      }

      return ResponseHelper.success(skillData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteTechnicalSkill(
    userId: ObjectId,
    skillId: ObjectId,
  ): Promise<Response> {
    try {
      const existing =
        await this.technicalSkillRepository.getTechnicalSkillById(skillId);
      if (!existing || !existing.userId.equals(userId)) {
        return ResponseHelper.error("Compétence non trouvée ou accès refusé");
      }

      const deleted =
        await this.technicalSkillRepository.deleteTechnicalSkill(skillId);
      if (!deleted) {
        return ResponseHelper.error("Échec de la suppression");
      }

      // Optionnel : retirer des coins
      try {
        await this.userRepository.removeCoins(
          userId,
          COINS_CONFIG.REMOVE_SKILL || 10,
        );
      } catch (coinErr) {
        console.error("Erreur lors du retrait de coins:", coinErr);
      }

      return ResponseHelper.success({
        message: "Compétence supprimée avec succès",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTechnicalSkillById(skillId: ObjectId): Promise<Response> {
    try {
      const skill =
        await this.technicalSkillRepository.getTechnicalSkillById(skillId);
      if (!skill) {
        return ResponseHelper.error("Compétence non trouvée");
      }
      return ResponseHelper.success(skill);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
