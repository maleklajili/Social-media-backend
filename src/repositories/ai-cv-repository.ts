import type { ObjectId } from "mongodb";
import type { IAiCvRepository } from "../interfaces/ai-cv/i-ai-cv-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { AiCv } from "../models/ai-cv";

export class AiCvRepository implements IAiCvRepository {
  private collection = CollectionsManager.aiCvCollection;

  async create(aiCv: AiCv): Promise<void> {
    await this.collection.insertOne(aiCv);
  }

  async getByUserId(userId: ObjectId): Promise<AiCv[]> {
    return this.collection
      .find({ userId }, { projection: { content: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getById(id: ObjectId, userId: ObjectId): Promise<AiCv | null> {
    return this.collection.findOne({ _id: id, userId });
  }

  async deleteById(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }
}
