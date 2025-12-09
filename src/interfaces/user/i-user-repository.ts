import { ObjectId } from "mongodb";
import type { User } from "../../models/user";

export interface IUserRepository {
  findById(
    userId: ObjectId | undefined,
    withPassword: number,
  ): Promise<User | null>;
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
}
