import { ObjectId } from "mongodb";
import { BaseService } from "../base/base-service";
import type { PersonalSkill } from "../../models/skills/personal-skill";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { IPersonalSkillRepository } from "../../interfaces/skills/i-personal-skill-repository";
import type { IPersonalSkillService } from "../../interfaces/skills/i-personal-skill-service";
import { ResponseHelper } from "../../utils/response-helper";

export class PersonalSkillService
  extends BaseService<PersonalSkill>
  implements IPersonalSkillService
{
  constructor(private personalSkillRepository: IPersonalSkillRepository) {
    super(CollectionsManager.personalSkillCollection);
  }

  async getPersonalSkillsByUser(userId: ObjectId): Promise<Response> {
    try {
      const skills =
        await this.personalSkillRepository.getPersonalSkillsByUserId(userId);
      return ResponseHelper.success(skills);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async addPersonalSkill(
    userId: ObjectId,
    skillData: Partial<PersonalSkill>,
  ): Promise<Response> {
    try {
      // Validation
      if (!skillData.name || !skillData.category) {
        return ResponseHelper.error("Nom et catégorie sont requis");
      }

      const skill: PersonalSkill = {
        _id: new ObjectId(),
        userId,
        name: skillData.name,
        category: skillData.category,
        description: skillData.description,
        examples: skillData.examples || [],
        strength: skillData.strength || false,
        endorsements: skillData.endorsements || 0,
        icon: skillData.icon || "brain",
      };

      const createdSkill =
        await this.personalSkillRepository.addPersonalSkill(skill);
      return ResponseHelper.success(createdSkill);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async updatePersonalSkill(
    userId: ObjectId,
    skillId: ObjectId,
    skillData: Partial<PersonalSkill>,
  ): Promise<Response> {
    try {
      const existingSkill =
        await this.personalSkillRepository.getPersonalSkillById(skillId);
      if (!existingSkill || !existingSkill.userId.equals(userId)) {
        return ResponseHelper.error("Compétence non trouvée ou accès refusé");
      }

      const updated = await this.personalSkillRepository.updatePersonalSkill(
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

  async deletePersonalSkill(
    userId: ObjectId,
    skillId: ObjectId,
  ): Promise<Response> {
    try {
      const existingSkill =
        await this.personalSkillRepository.getPersonalSkillById(skillId);
      if (!existingSkill || !existingSkill.userId.equals(userId)) {
        return ResponseHelper.error("Compétence non trouvée ou accès refusé");
      }

      const deleted =
        await this.personalSkillRepository.deletePersonalSkill(skillId);
      if (!deleted) {
        return ResponseHelper.error("Échec de la suppression");
      }

      return ResponseHelper.success({
        message: "personal skill deleted successfully",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getPersonalSkillById(skillId: ObjectId): Promise<Response> {
    try {
      const skill =
        await this.personalSkillRepository.getPersonalSkillById(skillId);
      if (!skill) {
        return ResponseHelper.error("Compétence non trouvée");
      }
      return ResponseHelper.success(skill);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
