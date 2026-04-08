import { ObjectId, type OptionalUnlessRequiredId } from "mongodb";
import validator from "validator";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { User } from "../models/user";

export class userRepository implements IUserRepository {
  private collection = CollectionsManager.userCollection;
  private postCollection = CollectionsManager.postCollection;
  private commentCollection = CollectionsManager.commentCollection;

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
  async delete(userId: ObjectId): Promise<void> {
    await this.collection.deleteOne({ _id: userId });
  }

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

  async countFriendSuggestions(
    userId: ObjectId,
    search: string,
  ): Promise<number> {
    const following = (await this.findById(userId, 0))?.following || [];
    const followingIds = following.map((id) => id.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {
      _id: { $ne: userId, $nin: followingIds.map((id) => new ObjectId(id)) },
    };
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { userName: regex },
      ];
    }
    return this.collection.countDocuments(filter);
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

  async getMutualFriendsList(
    userId1: ObjectId,
    userId2: ObjectId,
  ): Promise<User[]> {
    const [user1, user2] = await Promise.all([
      this.findById(userId1, 0),
      this.findById(userId2, 0),
    ]);
    if (!user1 || !user2) return [];

    const following1 = user1.following || [];
    const following2 = user2.following || [];

    const set1 = new Set(following1.map((id) => id.toString()));
    const set2 = new Set(following2.map((id) => id.toString()));

    const mutualIds = [...set1]
      .filter((id) => set2.has(id))
      .map((id) => new ObjectId(id))
      .filter((id) => !id.equals(userId1) && !id.equals(userId2));

    if (mutualIds.length === 0) return [];
    return this.collection
      .find({ _id: { $in: mutualIds } })
      .toArray() as Promise<User[]>;
  }

  async getFriendSuggestions(
    userId: ObjectId,
    skip: number,
    limit: number,
    search: string,
  ): Promise<User[]> {
    const following = (await this.findById(userId, 0))?.following || [];
    const followingIds = following.map((id) => id.toString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {
      _id: { $ne: userId, $nin: followingIds.map((id) => new ObjectId(id)) },
    };
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { userName: regex },
      ];
    }
    return this.collection
      .find(filter)
      .skip(skip)
      .limit(limit)
      .project({ password: 0 })
      .toArray() as Promise<User[]>;
  }

  async followCompany(userId: ObjectId, companyId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      {
        $addToSet: { followingCompanies: companyId },
        $inc: { followingCount: 1 },
      },
    );
  }

  async unfollowCompany(userId: ObjectId, companyId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      {
        $pull: { followingCompanies: companyId },
        $inc: { followingCount: -1 },
      },
    );
  }

  async getFollowedCompanies(userId: ObjectId): Promise<ObjectId[]> {
    const user = await this.collection.findOne(
      { _id: userId },
      { projection: { followingCompanies: 1 } },
    );
    return user?.followingCompanies || [];
  }

  async isFollowingCompany(
    userId: ObjectId,
    companyId: ObjectId,
  ): Promise<boolean> {
    const user = await this.collection.findOne(
      { _id: userId, followingCompanies: companyId },
      { projection: { _id: 1 } },
    );
    return !!user;
  }

  /**
   * Récupérer les statistiques complètes d'un utilisateur
   * @param userId - ID de l'utilisateur
   * @returns Statistiques: postsCount, commentsCount, followersCount, followingCount
   */
  async getUserStats(userId: ObjectId): Promise<{
    postsCount: number;
    commentsCount: number;
    followersCount: number;
    followingCount: number;
  }> {
    try {
      const postsCount = await this.postCollection.countDocuments({
        userId: userId,
      });

      const commentsCount = await this.commentCollection.countDocuments({
        userId: userId,
      });

      const user = await this.collection.findOne(
        { _id: userId },
        { projection: { followerCount: 1, followingCount: 1 } },
      );

      return {
        postsCount,
        commentsCount,
        followersCount: user?.followerCount || 0,
        followingCount: user?.followingCount || 0,
      };
    } catch (err) {
      console.error("Error getting user stats:", err);
      throw err;
    }
  }
}
