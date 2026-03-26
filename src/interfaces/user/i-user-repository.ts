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
  searchUsers(
    query: string,
    currentUserId: ObjectId,
    limit?: number,
  ): Promise<User[]>;
  getMutualFriendsList(userId1: ObjectId, userId2: ObjectId): Promise<User[]>;
  countFriendSuggestions(userId: ObjectId, search: string): Promise<number>;
  getFriendSuggestions(
    userId: ObjectId,
    skip: number,
    limit: number,
    search: string,
  ): Promise<User[]>;
  followCompany(userId: ObjectId, companyId: ObjectId): Promise<void>;
  unfollowCompany(userId: ObjectId, companyId: ObjectId): Promise<void>;
  getFollowedCompanies(userId: ObjectId): Promise<ObjectId[]>;
  isFollowingCompany(userId: ObjectId, companyId: ObjectId): Promise<boolean>;
  getUserStats(userId: ObjectId): Promise<{
    postsCount: number;
    commentsCount: number;
    followersCount: number;
    followingCount: number;
  }>;
}
