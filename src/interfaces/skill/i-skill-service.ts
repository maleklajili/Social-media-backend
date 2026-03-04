import type { ObjectId } from "mongodb";
import type { Skill } from "../../models/skill";

export interface ISkillService {
  createOneSkill(
    skill: Skill,
    formData: FormData,
    certifName: string[],
  ): Promise<Response>;

  createManySkills(
    skills: Skill[],
    formData: FormData,
    certifNamesList: string[][],
  ): Promise<Response>;
  getSkillsByUserId(userId: ObjectId): Promise<Skill[]>;
}
