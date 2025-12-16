import type { ObjectId } from "mongodb";
import type { PersonalSkill } from "../../models/skills/personal-skill";

export interface IPersonalSkillService {
  getPersonalSkillsByUser(userId: ObjectId): Promise<Response>;
  addPersonalSkill(
    userId: ObjectId,
    skillData: Partial<PersonalSkill>,
  ): Promise<Response>;
  updatePersonalSkill(
    userId: ObjectId,
    skillId: ObjectId,
    skillData: Partial<PersonalSkill>,
  ): Promise<Response>;
  deletePersonalSkill(userId: ObjectId, skillId: ObjectId): Promise<Response>;
  getPersonalSkillById(skillId: ObjectId): Promise<Response>;
}
