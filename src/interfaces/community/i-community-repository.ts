import type { ObjectId } from "mongodb";
import type { Community } from "../../models/community";

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
  incrementMembers(communityId: ObjectId, amount: number): Promise<void>;
  decrementMembers(communityId: ObjectId, amount: number): Promise<void>;
}
