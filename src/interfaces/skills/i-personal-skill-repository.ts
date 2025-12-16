import type { ObjectId } from "mongodb";
import type { PersonalSkill } from "../../models/skills/personal-skill";

export interface IPersonalSkillRepository {
  getPersonalSkillsByUserId(userId: ObjectId): Promise<PersonalSkill[]>;
  getPersonalSkillById(id: ObjectId): Promise<PersonalSkill | null>;
  addPersonalSkill(skill: PersonalSkill): Promise<PersonalSkill>;
  updatePersonalSkill(
    id: ObjectId,
    skill: Partial<PersonalSkill>,
  ): Promise<boolean>;
  deletePersonalSkill(id: ObjectId): Promise<boolean>;
}
