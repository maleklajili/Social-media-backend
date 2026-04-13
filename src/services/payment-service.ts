import { ObjectId } from "mongodb";
import type { PlanType, Payment } from "../models/payment";
import { CollectionsManager } from "../models/base/collection-manager";

const PLAN_PRICES: Record<string, number> = {
  pro: 1990, // 19.90 TND en millimes
  gold: 4990, // 49.90 TND en millimes
};

const PLAN_COINS: Record<string, number> = {
  pro: 500,
  gold: 2000,
};

// Infos bancaires renvoyées au client
export const BANK_INFO = {
  bankName: "Banque Nationale Agricole (BNA)",
  iban: "TN59 0001 8000 0000 1234 5678",
  rib: "01 800 0000001234567 89",
  accountHolder: "CvBuilder SARL",
  swift: "BNTETNTT",
};

// ─── Créer une demande de paiement par virement ───
export async function createTransferPayment(
  userId: ObjectId,
  plan: PlanType,
  transferProof: string,
) {
  if (plan === "free") {
    throw new Error("Cannot pay for free plan");
  }

  const payment: Payment = {
    _id: new ObjectId(),
    userId,
    plan,
    amount: PLAN_PRICES[plan] ?? 0,
    status: "PENDING_VERIFICATION",
    transferProof,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await CollectionsManager.paymentCollection.insertOne(payment);
  return payment;
}

// ─── Admin : approuver un paiement ───
export async function approvePayment(
  paymentId: ObjectId,
  adminId: ObjectId,
  adminNote?: string,
) {
  const payment = await CollectionsManager.paymentCollection.findOne({
    _id: paymentId,
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "PENDING_VERIFICATION") {
    throw new Error("Payment already processed");
  }

  await CollectionsManager.paymentCollection.updateOne(
    { _id: paymentId },
    {
      $set: {
        status: "SUCCESS",
        adminNote,
        verifiedAt: new Date(),
        verifiedBy: adminId,
        updatedAt: new Date(),
      },
    },
  );

  // Activer le plan
  await activatePlan(payment.userId, payment.plan);
  return { approved: true };
}

// ─── Admin : rejeter un paiement ───
export async function rejectPayment(
  paymentId: ObjectId,
  adminId: ObjectId,
  adminNote?: string,
) {
  const payment = await CollectionsManager.paymentCollection.findOne({
    _id: paymentId,
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "PENDING_VERIFICATION") {
    throw new Error("Payment already processed");
  }

  await CollectionsManager.paymentCollection.updateOne(
    { _id: paymentId },
    {
      $set: {
        status: "REJECTED",
        adminNote,
        verifiedAt: new Date(),
        verifiedBy: adminId,
        updatedAt: new Date(),
      },
    },
  );
  return { rejected: true };
}

// ─── Admin : liste des paiements en attente ───
export async function getPendingPayments() {
  return CollectionsManager.paymentCollection
    .find({ status: "PENDING_VERIFICATION" })
    .sort({ createdAt: -1 })
    .toArray();
}

// ─── Activer le plan premium ───
async function activatePlan(userId: ObjectId, plan: PlanType) {
  const coins = PLAN_COINS[plan] || 0;

  await CollectionsManager.userCollection.updateOne(
    { _id: userId },
    {
      $set: {
        plan,
        planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
        updatedAt: new Date(),
      },
      $inc: { coins },
    },
  );

  if (coins > 0) {
    await CollectionsManager.transactionCollection.insertOne({
      _id: new ObjectId(),
      userId,
      amount: coins,
      type: "earned",
      description: `Coins offerts — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
      itemType: "subscription",
      metadata: { plan },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// ─── Obtenir le plan actuel de l'utilisateur ───
export async function getUserPlan(userId: ObjectId) {
  const user = await CollectionsManager.userCollection.findOne(
    { _id: userId },
    { projection: { plan: 1, planExpiry: 1, coins: 1 } },
  );

  if (!user) throw new Error("User not found");

  const plan = user.plan || "free";
  const expired = user.planExpiry && new Date(user.planExpiry) < new Date();

  if (expired && plan !== "free") {
    await CollectionsManager.userCollection.updateOne(
      { _id: userId },
      {
        $set: { plan: "free", updatedAt: new Date() },
        $unset: { planExpiry: 1 },
      },
    );
    return {
      plan: "free" as PlanType,
      planExpiry: null,
      coins: user.coins || 0,
    };
  }

  return {
    plan: plan as PlanType,
    planExpiry: user.planExpiry || null,
    coins: user.coins || 0,
  };
}

// ─── Vérifier le statut d'un paiement ───
export async function getPaymentStatus(paymentId: ObjectId) {
  const payment = await CollectionsManager.paymentCollection.findOne({
    _id: paymentId,
  });
  if (!payment) throw new Error("Payment not found");
  return { status: payment.status };
}

// ─── Historique des paiements ───
export async function getPaymentHistory(userId: ObjectId) {
  return CollectionsManager.paymentCollection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
}
