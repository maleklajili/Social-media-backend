import type { ObjectId } from "mongodb";
import type { IPersonalSkillRepository } from "../../interfaces/skills/i-personal-skill-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { PersonalSkill } from "../../models/skills/personal-skill";

export class PersonalSkillRepository implements IPersonalSkillRepository {
  private collection = CollectionsManager.personalSkillCollection;

  async getPersonalSkillsByUserId(userId: ObjectId): Promise<PersonalSkill[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getPersonalSkillById(id: ObjectId): Promise<PersonalSkill | null> {
    return this.collection.findOne({ _id: id });
  }

  async addPersonalSkill(skill: PersonalSkill): Promise<PersonalSkill> {
    await this.collection.insertOne(skill);
    return skill;
  }

  async updatePersonalSkill(
    id: ObjectId,
    skill: Partial<PersonalSkill>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...skill, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async deletePersonalSkill(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
