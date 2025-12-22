// src/repositories/skills/technical-skill-repository.ts
import type { ObjectId } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { TechnicalSkill } from "../../models/skills/technical-skill";
import type { ITechnicalSkillRepository } from "../../interfaces/skills/i-technical-skill-repository";

export class TechnicalSkillRepository implements ITechnicalSkillRepository {
  private collection = CollectionsManager.technicalSkillCollection;

  async getTechnicalSkillsByUserId(
    userId: ObjectId,
  ): Promise<TechnicalSkill[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getTechnicalSkillById(id: ObjectId): Promise<TechnicalSkill | null> {
    return this.collection.findOne({ _id: id });
  }

  async addTechnicalSkill(skill: TechnicalSkill): Promise<TechnicalSkill> {
    await this.collection.insertOne(skill);
    return skill;
  }

  async updateTechnicalSkill(
    id: ObjectId,
    skill: Partial<TechnicalSkill>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...skill, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async deleteTechnicalSkill(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
