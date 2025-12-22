// src/interfaces/skills/i-technical-skill-repository.ts
import type { ObjectId } from "mongodb";
import type { TechnicalSkill } from "../../models/skills/technical-skill";

export interface ITechnicalSkillRepository {
  getTechnicalSkillsByUserId(userId: ObjectId): Promise<TechnicalSkill[]>;
  getTechnicalSkillById(id: ObjectId): Promise<TechnicalSkill | null>;
  addTechnicalSkill(skill: TechnicalSkill): Promise<TechnicalSkill>;
  updateTechnicalSkill(
    id: ObjectId,
    skill: Partial<TechnicalSkill>,
  ): Promise<boolean>;
  deleteTechnicalSkill(id: ObjectId): Promise<boolean>;
}
