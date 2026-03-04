import { ObjectId } from "mongodb";
import type { ISkillRepository } from "../interfaces/skill/i-skill-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Skill } from "../models/skill";

export class skillRepository implements ISkillRepository {
  private collection = CollectionsManager.skillCollection;

  async findById(skillId: ObjectId): Promise<Skill | null> {
    return await this.collection.findOne({ _id: skillId });
  }
  async findByName(skillName: string): Promise<Skill | null> {
    return await this.collection.findOne({ name: skillName });
  }

  async createSkill(skill: Skill): Promise<void> {
    await this.collection.insertOne(skill);
  }

  async createManySkills(skills: Skill[]): Promise<void> {
    await this.collection.insertMany(skills);
  }

  async updateMany(userId: ObjectId, skills: Skill[]): Promise<void> {
    if (!skills || skills.length === 0) return;

    const operations = skills.map((skill) => {
      return {
        updateOne: {
          filter: { _id: skill._id, userId },
          update: {
            $set: {
              // Classification
              categorie: skill.categorie,
              sousCategorie: skill.sousCategorie,
              // Core Skill Details
              name: skill.name,
              level: skill.level,
              description: skill.description,
              color: skill.color,
              // Metrics
              experienceNumber: skill.experienceNumber,
              projectNumber: skill.projectNumber,
              percentage: skill.percentage,
              // Certifications
              certifications: [],
              certifed: skill.certifed,
              // Flags
              favorite: skill.favorite,
              apprenticeship: skill.apprenticeship,
              // Timestamps
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    await this.collection.bulkWrite(operations);
  }

  async findByUserId(userId: ObjectId): Promise<Skill[]> {
    return await this.collection.find({ userId }).toArray();
  }
}
