// interfaces/friend-group/i-friend-group-service.ts
import type { ObjectId } from "mongodb";
import type { FriendGroup } from "../../models/friend-group";

export interface IFriendGroupService {
  createFriendGroup(
    userId: ObjectId,
    name: string,
    description?: string,
    icon?: string,
    color?: string,
  ): Promise<Response>;

  getUserFriendGroups(userId: ObjectId): Promise<Response>;
  getFriendGroupById(groupId: ObjectId, userId: ObjectId): Promise<Response>;
  updateFriendGroup(
    groupId: ObjectId,
    userId: ObjectId,
    updates: Partial<FriendGroup>,
  ): Promise<Response>;
  deleteFriendGroup(groupId: ObjectId, userId: ObjectId): Promise<Response>;
  addMemberToGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<Response>;
  removeMemberFromGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<Response>;
  addMembersToGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<Response>;
  removeMembersFromGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<Response>;
  searchFriendGroups(userId: ObjectId, query: string): Promise<Response>;
}
