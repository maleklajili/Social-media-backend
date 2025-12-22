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
  async getTechnicalSkillsGroupedByCategory(
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const skills =
        await this.technicalSkillRepository.getTechnicalSkillsByUserId(userId);

      // Grouper les compétences par catégorie
      const groupedByCategory = skills.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: Record<string, any[]>, skill: any) => {
          const category = skill.category || "Autre";
          if (!acc[category]) {
            acc[category] = [];
          }

          // Transformer chaque compétence au format désiré
          acc[category].push({
            name: skill.name,
            level: skill.level || 0,
            certified: skill.certified || false,
            yearsOfExperience: skill.yearsOfExperience || 0,
            isFavorite: skill.isFavorite || false,
            color: skill.color,
            // Ajoutez d'autres champs si nécessaire
          });

          return acc;
        },
        {},
      );

      // Convertir l'objet en tableau structuré
      const structuredResult = Object.keys(groupedByCategory).map(
        (category, index) => {
          // Définir l'icône en fonction de la catégorie
          let icon;
          switch (category.toLowerCase()) {
            case "frontend":
            case "développement front-end":
              icon = { className: "h-5 w-5 text-blue-500", type: "Code" };
              break;
            case "backend":
            case "développement back-end":
              icon = { className: "h-5 w-5 text-green-500", type: "Code" };
              break;
            case "devops":
            case "devops & outils":
              icon = { className: "h-5 w-5 text-purple-500", type: "Code" };
              break;
            default:
              icon = { className: "h-5 w-5 text-gray-500", type: "Code" };
          }

          return {
            id: index + 1,
            name: this.formatCategoryName(category),
            icon: icon,
            expanded: true, // Par défaut, les sections sont développées
            skills: groupedByCategory[category],
          };
        },
      );

      return ResponseHelper.success(structuredResult);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  // Méthode utilitaire pour formater le nom des catégories
  private formatCategoryName(category: string): string {
    const categoryMap: Record<string, string> = {
      frontend: "Développement Front-end",
      backend: "Développement Back-end",
      devops: "DevOps & Outils",
      mobile: "Développement Mobile",
      database: "Bases de données",
      cloud: "Cloud & Infra",
      design: "Design UI/UX",
      other: "Autres Compétences",
    };

    return categoryMap[category.toLowerCase()] || category;
  }
}
