import type { ObjectId } from "mongodb";
import type { Community } from "../../models/community/community";

export interface ICommunityService {
  createCommunity(
    userId: ObjectId,
    communityData: Partial<Community>,
    formData?: FormData,
  ): Promise<Response>;

  updateCommunity(
    userId: ObjectId,
    communityId: ObjectId,
    communityData: Partial<Community>,
    formData?: FormData,
  ): Promise<Response>;

  deleteCommunity(userId: ObjectId, communityId: ObjectId): Promise<Response>;

  joinCommunity(userId: ObjectId, communityId: ObjectId): Promise<Response>;

  leaveCommunity(userId: ObjectId, communityId: ObjectId): Promise<Response>;

  getCommunityDetails(communityName: string): Promise<Response>;

  getPopularCommunities(limit?: number): Promise<Response>;

  searchCommunities(query: string, limit?: number): Promise<Response>;

  getCommunityMembers(communityId: ObjectId): Promise<Response>;
  getCommunityById(communityId: ObjectId): Promise<Response>;
  checkUserMembership(
    userId: ObjectId,
    communityId: ObjectId,
  ): Promise<Response>;

  getUserCommunities(userId: ObjectId): Promise<Response>;
}
