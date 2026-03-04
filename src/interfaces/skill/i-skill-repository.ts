import type { ObjectId } from "mongodb";
import type { Skill } from "../../models/skill";

export interface ISkillRepository {
  createSkill(skill: Skill): Promise<void>;
  createManySkills(skills: Skill[]): Promise<void>;
  findById(skillId: ObjectId | undefined): Promise<Skill | null>;
  findByName(skillName: string): Promise<Skill | null>;
  updateMany(userId: ObjectId, skills: Skill[]): Promise<void>;
  findByUserId(userId: ObjectId): Promise<Skill[]>;
}
