// src/interfaces/skills/i-technical-skill-service.ts
import type { ObjectId } from "mongodb";
import type { TechnicalSkill } from "../../models/skills/technical-skill";

export interface ITechnicalSkillService {
  getTechnicalSkillsByUser(userId: ObjectId): Promise<Response>;
  addTechnicalSkill(
    userId: ObjectId,
    skillData: Partial<TechnicalSkill>,
  ): Promise<Response>;
  updateTechnicalSkill(
    userId: ObjectId,
    skillId: ObjectId,
    skillData: Partial<TechnicalSkill>,
  ): Promise<Response>;
  deleteTechnicalSkill(userId: ObjectId, skillId: ObjectId): Promise<Response>;
  getTechnicalSkillById(skillId: ObjectId): Promise<Response>;
}
