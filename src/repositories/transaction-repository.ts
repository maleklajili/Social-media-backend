// repositories/transaction-repository.ts
import { Collection, ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Transaction, TransactionType } from "../models/transaction";
import type { ITransactionRepository } from "../interfaces/transaction/i-transaction-repository";

export class TransactionRepository implements ITransactionRepository {
  private collection: Collection<Transaction>;

  constructor() {
    this.collection = CollectionsManager.transactionCollection;
  }

  async create(transaction: Transaction): Promise<Transaction> {
    const result = await this.collection.insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  }

  async findByUserId(
    userId: ObjectId,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments({ userId }),
    ]);

    return { transactions, total };
  }

  async findByType(
    userId: ObjectId,
    type: TransactionType,
  ): Promise<Transaction[]> {
    return this.collection
      .find({ userId, type })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getTotalBalance(userId: ObjectId): Promise<number> {
    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ];

    const result = await this.collection.aggregate(pipeline).toArray();
    return result[0]?.total || 0;
  }

  async getTransactionsCount(userId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ userId });
  }

  async deleteByItemId(itemId: ObjectId): Promise<void> {
    await this.collection.deleteMany({ itemId });
  }
}
