// interfaces/transaction/i-transaction-service.ts
import { ObjectId } from "mongodb";
import type { Transaction, TransactionType } from "../../models/transaction";

export interface ITransactionService {
  /**
   * Créer une nouvelle transaction
   */
  createTransaction(
    userId: ObjectId,
    amount: number,
    type: TransactionType,
    description: string,
    itemType?: string,
    itemId?: ObjectId | string,
  ): Promise<Transaction>;

  /**
   * Récupérer les transactions d'un utilisateur avec pagination
   */
  getUserTransactions(
    userId: ObjectId,
    page?: number,
    limit?: number,
  ): Promise<Response>;

  /**
   * Récupérer le solde total d'un utilisateur
   */
  getUserBalance(userId: ObjectId): Promise<Response>;

  /**
   * Récupérer les transactions par type
   */
  getTransactionsByType(
    userId: ObjectId,
    type: TransactionType,
  ): Promise<Response>;

  /**
   * Récupérer le nombre total de transactions
   */
  getTransactionsCount(userId: ObjectId): Promise<Response>;

  /**
   * Récupérer les statistiques de transactions (pour dashboard)
   */
  getTransactionStats(
    userId: ObjectId,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Response>;

  /**
   * Vérifier si l'utilisateur a suffisamment de coins
   */
  hasSufficientBalance(userId: ObjectId, amount: number): Promise<boolean>;

  /**
   * Annuler/révoquer une transaction
   */
  revertTransaction(transactionId: ObjectId): Promise<Response>;
}
