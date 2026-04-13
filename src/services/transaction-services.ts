// services/transaction-services.ts
import { ObjectId } from "mongodb";
import type { Transaction, TransactionType } from "../models/transaction";
import type { ITransactionService } from "../interfaces/transaction/i-transaction-service";
import type { ITransactionRepository } from "../interfaces/transaction/i-transaction-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { ResponseHelper } from "../utils/response-helper";

export class TransactionService implements ITransactionService {
  constructor(
    private transactionRepository: ITransactionRepository,
    private userRepository: IUserRepository,
  ) {}

  async createTransaction(
    userId: ObjectId,
    amount: number,
    type: TransactionType,
    description: string,
    itemType?: string,
    itemId?: ObjectId | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    // Validation des paramètres
    if (!userId || amount === undefined) {
      throw new Error("User ID and amount are required");
    }

    // Vérifier que l'utilisateur existe
    const user = await this.userRepository.findById(userId, 0);
    if (!user) {
      throw new Error("User not found");
    }

    // Pour les dépenses, vérifier le solde
    if (type === "spent" || (amount < 0 && type !== "purchased")) {
      const currentBalance =
        await this.transactionRepository.getTotalBalance(userId);
      if (currentBalance + amount < 0) {
        throw new Error("Insufficient balance");
      }
    }

    const transaction: Transaction = {
      _id: new ObjectId(),
      userId,
      amount,
      type,
      description,
      itemType,
      itemId,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.transactionRepository.create(transaction);
  }
  // Add this method to the TransactionService class
  async getAllTransactions(
    page: number = 1,
    limit: number = 20,
    filters?: {
      userId?: ObjectId;
      type?: TransactionType;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Response> {
    try {
      const result = await this.transactionRepository.findAll(
        page,
        limit,
        filters,
      );

      // Optional: Calculate summary statistics
      const summary = {
        totalAmount: result.transactions.reduce((sum, t) => sum + t.amount, 0),
        byType: {
          earned: result.transactions
            .filter((t) => t.type === "earned")
            .reduce((sum, t) => sum + t.amount, 0),
          spent: Math.abs(
            result.transactions
              .filter((t) => t.type === "spent")
              .reduce((sum, t) => sum + t.amount, 0),
          ),
          purchased: result.transactions
            .filter((t) => t.type === "purchased")
            .reduce((sum, t) => sum + t.amount, 0),
        },
      };

      return ResponseHelper.success({
        ...result,
        page,
        limit,
        summary,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  async getUserTransactions(
    userId: ObjectId,
    page: number = 1,
    limit: number = 20,
  ): Promise<Response> {
    try {
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      const result = await this.transactionRepository.findByUserId(
        userId,
        page,
        limit,
      );

      // Calculer le solde actuel
      const currentBalance =
        await this.transactionRepository.getTotalBalance(userId);

      return ResponseHelper.success({
        ...result,
        currentBalance,
        page,
        limit,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getUserBalance(userId: ObjectId): Promise<Response> {
    try {
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      const balance = await this.transactionRepository.getTotalBalance(userId);

      // Récupérer aussi le nombre de transactions
      const transactionCount =
        await this.transactionRepository.getTransactionsCount(userId);

      return ResponseHelper.success({
        balance,
        transactionCount,
        userId: userId.toString(),
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTransactionsByType(
    userId: ObjectId,
    type: TransactionType,
  ): Promise<Response> {
    try {
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      const validTypes: TransactionType[] = ["earned", "spent", "purchased"];
      if (!validTypes.includes(type)) {
        return ResponseHelper.error("Invalid transaction type");
      }

      const transactions = await this.transactionRepository.findByType(
        userId,
        type,
      );

      // Calculer le total pour ce type
      const totalForType = transactions.reduce((sum, t) => sum + t.amount, 0);

      return ResponseHelper.success({
        transactions,
        total: totalForType,
        type,
        count: transactions.length,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTransactionsCount(userId: ObjectId): Promise<Response> {
    try {
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      const count =
        await this.transactionRepository.getTransactionsCount(userId);
      return ResponseHelper.success({ count, userId: userId.toString() });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTransactionStats(
    userId: ObjectId,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Response> {
    try {
      if (!userId) {
        return ResponseHelper.error("User ID is required");
      }

      // Récupérer toutes les transactions (ou filtrées par date)
      const allTransactions = await this.transactionRepository.findByUserId(
        userId,
        1,
        1000,
      );

      // Filtrer par date si spécifié
      if (startDate && endDate) {
        allTransactions.transactions = allTransactions.transactions.filter(
          (t) => t.createdAt! >= startDate && t.createdAt! <= endDate,
        );
      }

      const transactions = allTransactions.transactions;

      // Calculer les statistiques
      const stats = {
        totalEarned: transactions
          .filter((t) => t.type === "earned")
          .reduce((sum, t) => sum + t.amount, 0),
        totalSpent: Math.abs(
          transactions
            .filter((t) => t.type === "spent")
            .reduce((sum, t) => sum + t.amount, 0),
        ),
        totalPurchased: transactions
          .filter((t) => t.type === "purchased")
          .reduce((sum, t) => sum + t.amount, 0),
        byItemType: {} as Record<string, number>,
        recentTransactions: transactions.slice(0, 10),
      };

      // Grouper par type d'item
      transactions.forEach((transaction) => {
        if (transaction.itemType) {
          stats.byItemType[transaction.itemType] =
            (stats.byItemType[transaction.itemType] || 0) + transaction.amount;
        }
      });

      // Calculer le solde actuel
      const currentBalance =
        await this.transactionRepository.getTotalBalance(userId);

      return ResponseHelper.success({
        ...stats,
        currentBalance,
        totalTransactions: transactions.length,
        period: startDate && endDate ? { startDate, endDate } : "all",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async hasSufficientBalance(
    userId: ObjectId,
    amount: number,
  ): Promise<boolean> {
    try {
      if (!userId || amount < 0) {
        return false;
      }

      const currentBalance =
        await this.transactionRepository.getTotalBalance(userId);
      return currentBalance >= amount;
    } catch (err) {
      console.error("Error checking balance:", err);
      return false;
    }
  }

  async revertTransaction(/* transactionId: ObjectId */): Promise<Response> {
    try {
      // Note: Cette méthode nécessiterait d'avoir accès à la transaction
      // Dans une implémentation réelle, vous devriez récupérer la transaction d'abord
      // puis créer une transaction inverse

      // Pour l'instant, retourner une erreur car non implémentée
      return ResponseHelper.error("Transaction reversion not implemented");

      // Exemple d'implémentation:
      // 1. Récupérer la transaction originale
      // 2. Créer une transaction inverse avec montant négatif
      // 3. Mettre à jour le statut de la transaction originale
      // 4. Retourner le résultat
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Méthode utilitaire pour les gains standards (expérience, éducation, etc.)
   */
  async addStandardEarning(
    userId: ObjectId,
    amount: number,
    itemType: string,
    itemId: ObjectId | string,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    return this.createTransaction(
      userId,
      amount, // Montant standard
      "earned",
      description,
      itemType,
      itemId,
      metadata,
    );
  }

  /**
   * Méthode utilitaire pour les dépenses standards
   */
  async addStandardSpending(
    userId: ObjectId,
    itemType: string,
    itemId: ObjectId | string,
    description: string,
    amount: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    // Vérifier le solde
    if (!(await this.hasSufficientBalance(userId, amount))) {
      throw new Error("Insufficient balance for this operation");
    }

    return this.createTransaction(
      userId,
      -amount, // Montant négatif pour les dépenses
      "spent",
      description,
      itemType,
      itemId,
      metadata,
    );
  }
}
