import { ObjectId } from "mongodb";
import type { User } from "../../models/user";

export interface IUserRepository {
  findById(
    userId: ObjectId | undefined,
    withPassword: number,
  ): Promise<User | null>;
  // Fetch multiple users by their ObjectId values (password excluded)
  findByIds(userIds: ObjectId[]): Promise<User[]>;
  findByIdentifier(identifier: string): Promise<User | null>;

  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  changePassword(
    userId: ObjectId | undefined,
    newPassword: string,
  ): Promise<void>;

  updateProfile(
    userId: ObjectId | undefined,
    userData: User,
  ): Promise<User | null>;
  addCoins(userId: ObjectId, amount: number): Promise<void>;
  removeCoins(userId: ObjectId, amount: number): Promise<void>;
  followUser(followerId: ObjectId, followingId: ObjectId): Promise<void>;
  unfollowUser(followerId: ObjectId, followingId: ObjectId): Promise<void>;
  getFollowers(userId: ObjectId): Promise<User[]>;
  getFollowing(userId: ObjectId): Promise<User[]>;
  isFollowing(followerId: ObjectId, followingId: ObjectId): Promise<boolean>;
  getFollowCounts(
    userId: ObjectId,
  ): Promise<{ followers: number; following: number }>;
  getMutualFriends(userId: ObjectId): Promise<User[]>; // Users who follow each other
  getFriendSuggestions(userId: ObjectId, limit?: number): Promise<User[]>; // Suggested friends based on mutual connections
  searchUsers(
    query: string,
    currentUserId: ObjectId,
    limit?: number,
  ): Promise<User[]>;
}
