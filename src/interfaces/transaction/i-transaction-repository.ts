// interfaces/transaction/i-transaction-repository.ts
import { ObjectId } from "mongodb";
import type { Transaction, TransactionType } from "../../models/transaction";

export interface ITransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  findByUserId(
    userId: ObjectId,
    page?: number,
    limit?: number,
  ): Promise<{ transactions: Transaction[]; total: number }>;
  findByType(userId: ObjectId, type: TransactionType): Promise<Transaction[]>;
  getTotalBalance(userId: ObjectId): Promise<number>;
  getTransactionsCount(userId: ObjectId): Promise<number>;
  deleteByItemId(itemId: ObjectId): Promise<void>;
}
