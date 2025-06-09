import { CollectionsManager } from "../models/base/collection-manager";
import { skillsByCategory } from "../models/global/skill-category";
import { SkillCategoryRespositroy } from "../repositories/global/skill-categorie-repository";
import { SkillCategoryServices } from "../services/skill-categorie-services";

export async function seedSkills() {
  const service = new SkillCategoryServices(new SkillCategoryRespositroy());

  const existing = await CollectionsManager.skillCategorieCollection.findOne(
    {},
  );
  if (!existing) {
    await service.insertMany(skillsByCategory);
  }
}
