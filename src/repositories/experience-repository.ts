import type { ObjectId } from "mongodb";
import type { IExerienceRepository } from "../interfaces/experience/i-experience-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Experience } from "../models/experience";

export class ExperienceRepository implements IExerienceRepository {
  private collection = CollectionsManager.experienceCollection;
  async addExperience(experience: Experience): Promise<void> {
    await this.collection.insertOne(experience);
  }

  async updatedExperience(experience: Experience): Promise<void> {
    await this.collection.updateOne(
      {
        _id: experience._id,
        userId: experience.userId,
      },
      { $set: experience },
    );
  }
  async getExperiencesByUserId(userId: ObjectId): Promise<Experience[]> {
    return this.collection.find({ userId }).toArray();
  }
}
