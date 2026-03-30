import type { ObjectId } from "mongodb";
import type { IManualCvRepository } from "../interfaces/manual-cv/i-manual-cv-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { ManualCv } from "../models/manual-cv";

export class ManualCvRepository implements IManualCvRepository {
  private collection = CollectionsManager.manualCvCollection;

  async create(cv: ManualCv): Promise<void> {
    await this.collection.insertOne(cv);
  }

  async getByUserId(userId: ObjectId): Promise<ManualCv[]> {
    return this.collection.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }

  async getById(id: ObjectId, userId: ObjectId): Promise<ManualCv | null> {
    return this.collection.findOne({ _id: id, userId });
  }

  async update(
    id: ObjectId,
    userId: ObjectId,
    data: Partial<ManualCv>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id, userId },
      { $set: { ...data, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async deleteById(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }
}
