import type { ISkillCategorieRepositroy } from "../interfaces/global/i-skill-categorie-repository";
import type { ISkillCategorieServices } from "../interfaces/global/i-skill-categorie-services";
import { CollectionsManager } from "../models/base/collection-manager";
import type { SkillCategory } from "../models/global/skill-category";
import { BaseService } from "./base/base-service";

export class SkillCategoryServices
  extends BaseService<SkillCategory>
  implements ISkillCategorieServices
{
  constructor(private skillCategorieRepository: ISkillCategorieRepositroy) {
    super(CollectionsManager.skillCategorieCollection);
  }
  async insertMany(skillCategories: SkillCategory[]): Promise<void> {
    this.skillCategorieRepository.insertMany(skillCategories);
  }
}
