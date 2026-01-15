import { ObjectId } from "mongodb";
import type { ICommunityRepository } from "../interfaces/community/i-community-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Community } from "../models/community";

export class CommunityRepository implements ICommunityRepository {
  private collection = CollectionsManager.communityCollection;

  async createCommunity(community: Community): Promise<void> {
    await this.collection.insertOne(community);
  }

  async updateCommunity(community: Community): Promise<void> {
    const { _id, ...data } = community;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteCommunity(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async getCommunityById(id: ObjectId): Promise<Community | null> {
    return this.collection.findOne({ _id: id });
  }

  async getCommunityByName(name: string): Promise<Community | null> {
    return this.collection.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
  }
  async getCommunityByNameExcludingId(
    name: string,
    excludeId: ObjectId,
  ): Promise<Community | null> {
    return this.collection.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: excludeId }, // Exclure l'ID spécifié
    });
  }
  async getPopularCommunities(limit: number = 10): Promise<Community[]> {
    return this.collection
      .find({ isPublic: true })
      .sort({ members: -1 })
      .limit(limit)
      .toArray();
  }

  async searchCommunities(
    query: string,
    limit: number = 10,
  ): Promise<Community[]> {
    return this.collection
      .find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { tags: { $regex: query, $options: "i" } },
        ],
        isPublic: true,
      })
      .limit(limit)
      .toArray();
  }

  async getCommunitiesByCategory(category: string): Promise<Community[]> {
    return this.collection.find({ category, isPublic: true }).toArray();
  }

  async incrementMembers(
    communityId: ObjectId,
    amount: number = 1,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: communityId },
      { $inc: { members: amount } },
    );
  }

  async decrementMembers(
    communityId: ObjectId,
    amount: number = 1,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: communityId },
      { $inc: { members: -amount } },
    );
  }
}
