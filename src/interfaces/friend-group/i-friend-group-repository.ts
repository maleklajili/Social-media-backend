// interfaces/friend-group/i-friend-group-repository.ts
import type { ObjectId } from "mongodb";
import type { FriendGroup } from "../../models/friend-group";

export interface IFriendGroupRepository {
  createFriendGroup(friendGroup: FriendGroup): Promise<FriendGroup>;
  updateFriendGroup(id: ObjectId, data: Partial<FriendGroup>): Promise<boolean>;
  deleteFriendGroup(id: ObjectId): Promise<boolean>;
  getFriendGroupById(id: ObjectId): Promise<FriendGroup | null>;
  getUserFriendGroups(userId: ObjectId): Promise<FriendGroup[]>;
  getFriendGroupByName(
    userId: ObjectId,
    name: string,
  ): Promise<FriendGroup | null>;
  addMemberToGroup(groupId: ObjectId, memberId: ObjectId): Promise<boolean>;
  removeMemberFromGroup(
    groupId: ObjectId,
    memberId: ObjectId,
  ): Promise<boolean>;
  addMembersToGroup(groupId: ObjectId, memberIds: ObjectId[]): Promise<boolean>;
  removeMembersFromGroup(
    groupId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<boolean>;
  isMemberInGroup(groupId: ObjectId, memberId: ObjectId): Promise<boolean>;
  getMembersCount(groupId: ObjectId): Promise<number>;
  getGroupsContainingMember(
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<FriendGroup[]>;
  clearGroupMembers(groupId: ObjectId): Promise<boolean>;
  searchFriendGroups(userId: ObjectId, query: string): Promise<FriendGroup[]>;
  getFriendGroupsByIds(ids: ObjectId[]): Promise<FriendGroup[]>;
  updateMembersCount(groupId: ObjectId, count: number): Promise<boolean>;
}
