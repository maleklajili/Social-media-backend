import type { ObjectId } from "mongodb";
import type { ServerRequest } from "../../config/interfaces/i-request";
import type { User } from "../../models/user";
import type { ChangePasswordPayload } from "../base/i-crud-controller";

export interface IUserService {
  findUserById(userId: ObjectId): Promise<Response>;
  changePassword(
    userId: ObjectId | undefined,
    body: ChangePasswordPayload,
  ): Promise<Response>;
  updateProfile(
    req: ServerRequest,
    user: User,
    formData: FormData,
  ): Promise<Response>;
  followUser(currentUserId: ObjectId, targetUserId: string): Promise<Response>;
  unfollowUser(
    currentUserId: ObjectId,
    targetUserId: string,
  ): Promise<Response>;
  getFollowers(userId: string, currentUserId?: ObjectId): Promise<Response>;
  getFollowing(userId: string, currentUserId?: ObjectId): Promise<Response>;
  getFollowStatus(
    currentUserId: ObjectId,
    targetUserId: string,
  ): Promise<Response>;
  getFriends(currentUserId: ObjectId): Promise<Response>;

  searchFriends(currentUserId: ObjectId, query: string): Promise<Response>;
  getMutualFriendsList(
    currentUserId: ObjectId,
    targetUserId: ObjectId,
  ): Promise<Response>;

  getFriendSuggestions(
    currentUserId: ObjectId,
    skip?: number,
    limit?: number,
    search?: string,
  ): Promise<{ data: User[]; total: number }>;
  getUserStats(userId: ObjectId | undefined): Promise<Response>;
}
