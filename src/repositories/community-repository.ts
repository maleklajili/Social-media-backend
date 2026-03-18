import { ObjectId } from "mongodb";
import type { ICommunityRepository } from "../interfaces/community/i-community-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Community } from "../models/community/community";
import type { CommunityMember } from "../models/community/community-member";

export class CommunityRepository implements ICommunityRepository {
  private collection = CollectionsManager.communityCollection;
  private memberCollection = CollectionsManager.communityMemberCollection;

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

  // Méthodes pour les membres
  async addMember(member: CommunityMember): Promise<void> {
    await this.memberCollection.insertOne(member);
  }

  async removeMember(
    communityId: ObjectId,
    userId: ObjectId,
  ): Promise<boolean> {
    const result = await this.memberCollection.deleteOne({
      communityId,
      userId,
    });
    return result.deletedCount === 1;
  }

  async getMember(
    communityId: ObjectId,
    userId: ObjectId,
  ): Promise<CommunityMember | null> {
    return this.memberCollection.findOne({ communityId, userId });
  }

  async getCommunityMembers(communityId: ObjectId): Promise<CommunityMember[]> {
    return this.memberCollection
      .find({ communityId })
      .sort({ joinedAt: -1 })
      .toArray();
  }

  async getCommunityMembersCount(communityId: ObjectId): Promise<number> {
    return this.memberCollection.countDocuments({ communityId });
  }

  async getUserCommunities(userId: ObjectId): Promise<Community[]> {
    const memberships = await this.memberCollection.find({ userId }).toArray();

    const communityIds = memberships.map((m) => m.communityId);

    if (communityIds.length === 0) {
      return [];
    }

    return this.collection.find({ _id: { $in: communityIds } }).toArray();
  }
  async findByIds(ids: ObjectId[]): Promise<Community[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return await this.collection.find({ _id: { $in: ids } }).toArray();
  }
  async getCommunityAdmins(communityId: ObjectId): Promise<CommunityMember[]> {
    try {
      const admins = await this.memberCollection
        .find({
          communityId: communityId,
          role: "admin",
          isBanned: { $ne: true }, // Exclure les membres bannis
        })
        .toArray();

      return admins as CommunityMember[];
    } catch (error) {
      console.error("Error getting community admins:", error);
      return [];
    }
  }
}
