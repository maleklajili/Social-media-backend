// repositories/friend-group-repository.ts
import { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { FriendGroup } from "../models/friend-group";
import type { IFriendGroupRepository } from "../interfaces/friend-group/i-friend-group-repository";

export class FriendGroupRepository implements IFriendGroupRepository {
  private collection = CollectionsManager.friendGroupCollection;

  async createFriendGroup(friendGroup: FriendGroup): Promise<FriendGroup> {
    const result = await this.collection.insertOne(friendGroup);
    return { ...friendGroup, _id: result.insertedId };
  }

  async updateFriendGroup(
    id: ObjectId,
    data: Partial<FriendGroup>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async deleteFriendGroup(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async getFriendGroupById(id: ObjectId): Promise<FriendGroup | null> {
    return this.collection.findOne({ _id: id });
  }

  async getUserFriendGroups(userId: ObjectId): Promise<FriendGroup[]> {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async getFriendGroupByName(
    userId: ObjectId,
    name: string,
  ): Promise<FriendGroup | null> {
    return this.collection.findOne({
      userId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
  }

  async addMemberToGroup(
    groupId: ObjectId,
    memberId: ObjectId,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $addToSet: { members: memberId },
        $set: { updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }

  async removeMemberFromGroup(
    groupId: ObjectId,
    memberId: ObjectId,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $pull: { members: memberId },
        $set: { updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }

  async addMembersToGroup(
    groupId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<boolean> {
    if (memberIds.length === 0) return false;

    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $addToSet: { members: { $each: memberIds } },
        $set: { updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }

  async removeMembersFromGroup(
    groupId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<boolean> {
    if (memberIds.length === 0) return false;

    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $pullAll: { members: memberIds },
        $set: { updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }

  async isMemberInGroup(
    groupId: ObjectId,
    memberId: ObjectId,
  ): Promise<boolean> {
    const group = await this.collection.findOne(
      { _id: groupId, members: memberId },
      { projection: { _id: 1 } },
    );
    return group !== null;
  }

  async getMembersCount(groupId: ObjectId): Promise<number> {
    const group = await this.collection.findOne(
      { _id: groupId },
      { projection: { members: 1 } },
    );
    return group?.members?.length || 0;
  }

  async getGroupsContainingMember(
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<FriendGroup[]> {
    return this.collection.find({ userId, members: memberId }).toArray();
  }

  async clearGroupMembers(groupId: ObjectId): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $set: { members: [], updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }

  async searchFriendGroups(
    userId: ObjectId,
    query: string,
  ): Promise<FriendGroup[]> {
    return this.collection
      .find({
        userId,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      })
      .toArray();
  }

  async getFriendGroupsByIds(ids: ObjectId[]): Promise<FriendGroup[]> {
    if (ids.length === 0) return [];

    return this.collection.find({ _id: { $in: ids } }).toArray();
  }

  async updateMembersCount(groupId: ObjectId, count: number): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: groupId },
      {
        $set: { membersCount: count, updatedAt: new Date() },
      },
    );
    return result.modifiedCount === 1;
  }
}
