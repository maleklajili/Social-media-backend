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
}
