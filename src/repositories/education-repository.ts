import type { ObjectId } from "mongodb";
import type { IEducationRepository } from "../interfaces/education/i-education-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Education } from "../models/education";

export class EducationRepository implements IEducationRepository {
  private collection = CollectionsManager.educationCollection;

  async addEducation(education: Education): Promise<void> {
    await this.collection.insertOne(education);
  }

  async updateEducation(education: Education): Promise<void> {
    const { _id, ...data } = education;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteEducation(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  async getEducationsByUserId(userId: ObjectId): Promise<Education[]> {
    return this.collection.find({ userId }).toArray();
  }
}
