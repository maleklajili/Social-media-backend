import type { ObjectId } from "mongodb";
import type { Community } from "../../models/community/community";
import type { CommunityMember } from "../../models/community/community-member";

export interface ICommunityRepository {
  createCommunity(community: Community): Promise<void>;
  updateCommunity(community: Community): Promise<void>;
  deleteCommunity(id: ObjectId): Promise<boolean>;
  getCommunityById(id: ObjectId): Promise<Community | null>;
  getCommunityByName(name: string): Promise<Community | null>;
  getCommunityByNameExcludingId(
    name: string,
    excludeId: ObjectId,
  ): Promise<Community | null>;
  getPopularCommunities(limit: number): Promise<Community[]>;
  searchCommunities(query: string, limit: number): Promise<Community[]>;
  getCommunitiesByCategory(category: string): Promise<Community[]>;
  incrementMembers(
    communityId: ObjectId,
    userId?: ObjectId,
    amount?: number,
  ): Promise<void>;
  decrementMembers(
    communityId: ObjectId,
    userId?: ObjectId,
    amount?: number,
  ): Promise<void>;
  isMember(communityId: ObjectId, userId: ObjectId): Promise<boolean>;

  // Méthodes pour les membres
  addMember(member: CommunityMember): Promise<void>;
  removeMember(communityId: ObjectId, userId: ObjectId): Promise<boolean>;
  getMember(
    communityId: ObjectId,
    userId: ObjectId,
  ): Promise<CommunityMember | null>;
  getCommunityMembers(communityId: ObjectId): Promise<CommunityMember[]>;
  getCommunityMembersCount(communityId: ObjectId): Promise<number>;
  getUserCommunities(userId: ObjectId): Promise<Community[]>;
  findByIds(ids: ObjectId[]): Promise<Community[]>;
  getCommunityAdmins(communityId: ObjectId): Promise<CommunityMember[]>;
}
