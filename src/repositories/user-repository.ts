import { ObjectId, type OptionalUnlessRequiredId } from "mongodb";
import validator from "validator";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { User } from "../models/user";

export class userRepository implements IUserRepository {
  private collection = CollectionsManager.userCollection;

  async findById(
    userId: ObjectId,
    withPassword: number = 0,
  ): Promise<User | null> {
    return this.collection.findOne(
      { _id: userId },
      { projection: { password: withPassword } },
    );
  }
  /*  async findByIds(ids: ObjectId[]): Promise<User[]> {
    return this.collection.find({ _id: { $in: ids } }).toArray();
  } */

  async findByIdentifier(identifier: string): Promise<User | null> {
    const isEmail = validator.isEmail(identifier);
    const query = isEmail ? { email: identifier } : { userName: identifier };
    return this.collection.findOne(query);
  }

  async create(user: OptionalUnlessRequiredId<User>): Promise<void> {
    await this.collection.insertOne(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.collection.findOne({ email });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.collection.findOne({ userName: username });
  }

  async changePassword(userId: ObjectId, newPassword: string): Promise<void> {
    this.collection.updateOne(
      { _id: userId },
      { $set: { password: newPassword } },
    );
  }

  async findByIds(userIds: ObjectId[]): Promise<User[]> {
    if (!userIds || userIds.length === 0) return [];
    const users = await this.collection
      .find({ _id: { $in: userIds } }, { projection: { password: 0 } })
      .toArray();
    return users;
  }

  async updateProfile(userId: ObjectId, userData: User): Promise<User | null> {
    const updatedUser = await this.collection.findOneAndUpdate(
      { _id: userId },
      { $set: userData },
      { returnDocument: "after", projection: { password: 0 } },
    );

    return updatedUser;
  }

  async addCoins(userId: ObjectId, amount: number): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      { $inc: { coins: amount } },
    );
  }
  // Dans user-repository.ts
  async removeCoins(userId: ObjectId, amount: number): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      { $inc: { coins: -amount } },
    );

    await this.collection.updateOne(
      { _id: userId, coins: { $lt: 0 } },
      { $set: { coins: 0 } },
    );
  }
  async followUser(followerId: ObjectId, followingId: ObjectId): Promise<void> {
    // Add to following array of follower
    await this.collection.updateOne(
      { _id: followerId },
      {
        $addToSet: { following: followingId },
        $inc: { followingCount: 1 },
      },
    );

    // Add to followers array of target user
    await this.collection.updateOne(
      { _id: followingId },
      {
        $addToSet: { followers: followerId },
        $inc: { followerCount: 1 },
      },
    );
  }

  async unfollowUser(
    followerId: ObjectId,
    followingId: ObjectId,
  ): Promise<void> {
    // Remove from following array of follower
    await this.collection.updateOne(
      { _id: followerId },
      {
        $pull: { following: followingId },
        $inc: { followingCount: -1 },
      },
    );

    // Remove from followers array of target user
    await this.collection.updateOne(
      { _id: followingId },
      {
        $pull: { followers: followerId },
        $inc: { followerCount: -1 },
      },
    );
  }

  async getFollowers(userId: ObjectId): Promise<User[]> {
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { followers: 1 } },
    );

    if (!user?.followers || user.followers.length === 0) {
      return [];
    }

    return this.collection
      .find({ _id: { $in: user.followers } }, { projection: { password: 0 } })
      .toArray();
  }

  async getFollowing(userId: ObjectId): Promise<User[]> {
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { following: 1 } },
    );

    if (!user?.following || user.following.length === 0) {
      return [];
    }

    return this.collection
      .find({ _id: { $in: user.following } }, { projection: { password: 0 } })
      .toArray();
  }

  async isFollowing(
    followerId: ObjectId,
    followingId: ObjectId,
  ): Promise<boolean> {
    const user = await this.collection.findOne(
      {
        _id: followerId,
        following: followingId,
      },
      { projection: { _id: 1 } },
    );

    return !!user;
  }

  async getFollowCounts(
    userId: ObjectId,
  ): Promise<{ followers: number; following: number }> {
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { followerCount: 1, followingCount: 1 } },
    );

    return {
      followers: user?.followerCount || 0,
      following: user?.followingCount || 0,
    };
  }
  async getMutualFriends(userId: ObjectId): Promise<User[]> {
    // Get the user's following and followers
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { following: 1, followers: 1 } },
    );

    if (!user) return [];

    const following = user.following || [];
    const followers = user.followers || [];

    // Find mutual connections (users who are in both arrays)
    const followingSet = new Set(following.map((id) => id.toString()));
    const mutualFriendIds = followers.filter((followerId) =>
      followingSet.has(followerId.toString()),
    );

    if (mutualFriendIds.length === 0) return [];

    // CORRECT: Using $and operator
    return this.collection
      .find(
        {
          $and: [{ _id: { $in: mutualFriendIds } }, { _id: { $ne: userId } }],
        },
        {
          projection: {
            password: 0,
            email: 0,
          },
        },
      )
      .toArray();
  }

  async getFriendSuggestions(
    userId: ObjectId,
    limit: number = 10,
  ): Promise<User[]> {
    // Get the user's following and followers
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { following: 1, followers: 1 } },
    );

    if (!user) return [];

    const following = user.following || [];
    const followers = user.followers || [];

    // Combine all connected users (following + followers)
    const connectedUsers = new Set([
      ...following.map((id) => id.toString()),
      ...followers.map((id) => id.toString()),
    ]);

    // Get users that the current user is following (to find friends-of-friends)
    const followingUsers = await this.collection
      .find({ _id: { $in: following } }, { projection: { following: 1 } })
      .toArray();

    // Collect potential suggestions (friends of friends)
    const suggestionScores = new Map<string, number>();

    for (const followedUser of followingUsers) {
      if (followedUser.following) {
        for (const potentialFriendId of followedUser.following) {
          const idStr = potentialFriendId.toString();

          // Skip if it's the current user or already connected
          if (idStr === userId.toString() || connectedUsers.has(idStr)) {
            continue;
          }

          // Increment score based on mutual connections
          suggestionScores.set(idStr, (suggestionScores.get(idStr) || 0) + 1);
        }
      }
    }

    // Sort by score and get top suggestions
    const sortedSuggestions = Array.from(suggestionScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => new ObjectId(id));

    if (sortedSuggestions.length === 0) {
      // If no suggestions from mutual friends, return random users
      return this.collection
        .find(
          {
            _id: {
              $ne: userId,
              $nin: Array.from(connectedUsers).map((id) => new ObjectId(id)),
            },
          },
          {
            projection: { password: 0 },
            limit: limit,
          },
        )
        .toArray();
    }

    return this.collection
      .find(
        { _id: { $in: sortedSuggestions } },
        { projection: { password: 0 } },
      )
      .toArray();
  }

  async searchUsers(
    query: string,
    currentUserId: ObjectId,
    limit: number = 20,
  ): Promise<User[]> {
    const searchRegex = new RegExp(query, "i");

    const users = await this.collection
      .find({
        $and: [
          { _id: { $ne: currentUserId } },
          {
            $or: [
              { firstName: searchRegex },
              { lastName: searchRegex },
              { userName: searchRegex },
              { email: searchRegex },
              { professionalTitle: searchRegex },
              { location: searchRegex },
            ],
          },
        ],
      })
      .project({ password: 0 })
      .limit(limit)
      .toArray();

    return users as User[]; // Type assertion
  }
}
