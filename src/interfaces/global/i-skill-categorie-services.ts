import type { SkillCategory } from "../../models/global/skill-category";

export interface ISkillCategorieServices {
  insertMany(skillCategories: SkillCategory[]): Promise<void>;
}
