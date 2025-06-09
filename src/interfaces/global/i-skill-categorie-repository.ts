import type { SkillCategory } from "../../models/global/skill-category";

export interface ISkillCategorieRepositroy {
  insertMany(skillCategories: SkillCategory[]): Promise<void>;
}
