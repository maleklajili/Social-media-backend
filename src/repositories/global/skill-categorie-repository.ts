import type { ISkillCategorieRepositroy } from "../../interfaces/global/i-skill-categorie-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { SkillCategory } from "../../models/global/skill-category";

export class SkillCategoryRespositroy implements ISkillCategorieRepositroy {
  private collection = CollectionsManager.skillCategorieCollection;
  async insertMany(skillCategories: SkillCategory[]): Promise<void> {
    await this.collection.insertMany(skillCategories);
  }
}
