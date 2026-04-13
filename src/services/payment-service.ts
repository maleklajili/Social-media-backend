import { ObjectId } from "mongodb";
import type { PlanType, Payment } from "../models/payment";
import { CollectionsManager } from "../models/base/collection-manager";

const FLOUCI_URL = "https://developers.flouci.com/api/generate_payment";
const APP_TOKEN = process.env.FLOUCI_APP_TOKEN;
const APP_SECRET = process.env.FLOUCI_APP_SECRET;
const BACKEND_URL =
  process.env.BACKEND_PUBLIC_URL ||
  `http://localhost:${process.env.PORT || 9000}`;

const PLAN_PRICES: Record<string, number> = {
  pro: 1990, // 19.90 TND en millimes
  gold: 4990, // 49.90 TND en millimes
};

const PLAN_COINS: Record<string, number> = {
  pro: 500,
  gold: 2000,
};

// ─── Créer un lien de paiement Flouci ───
export async function createFlouciPayment(plan: PlanType, userId: string) {
  if (!APP_TOKEN || !APP_SECRET) {
    throw new Error("Flouci credentials not configured");
  }
  if (plan === "free") {
    throw new Error("Cannot pay for free plan");
  }

  const trackingId = `${userId}_${plan}_${Date.now()}`;

  const res = await fetch(FLOUCI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_token: APP_TOKEN,
      app_secret: APP_SECRET,
      amount: PLAN_PRICES[plan],
      accept_card: true,
      session_timeout_secs: 1200,
      success_link: `${BACKEND_URL}/payment/success?userId=${userId}&plan=${plan}`,
      fail_link: `${BACKEND_URL}/payment/fail?userId=${userId}`,
      developer_tracking_id: trackingId,
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;

  if (!data.result?.link || !data.result?.payment_id) {
    throw new Error(data.message || "Flouci payment creation failed");
  }

  return {
    link: data.result.link,
    paymentId: data.result.payment_id,
    trackingId,
  };
}

// ─── Vérifier un paiement Flouci ───
export async function verifyFlouciPayment(paymentId: string) {
  if (!APP_TOKEN || !APP_SECRET) {
    throw new Error("Flouci credentials not configured");
  }

  const res = await fetch(
    `https://developers.flouci.com/api/verify_payment/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        apptokens: APP_TOKEN,
        appsecret: APP_SECRET,
      },
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;
  return data.result; // { status: 'SUCCESS' | 'PENDING' | 'FAILED' }
}

// ─── Sauvegarder l'intention de paiement ───
export async function savePaymentIntent(
  userId: ObjectId,
  paymentId: string,
  plan: PlanType,
  trackingId: string,
) {
  const payment: Payment = {
    _id: new ObjectId(),
    userId,
    paymentId,
    plan,
    amount: PLAN_PRICES[plan] ?? 0,
    status: "PENDING",
    developerTrackingId: trackingId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await CollectionsManager.paymentCollection.insertOne(payment);
  return payment;
}

// ─── Activer le plan premium ───
export async function activatePlan(
  userId: string,
  plan: PlanType,
  paymentId: string,
) {
  const userOid = new ObjectId(userId);
  const coins = PLAN_COINS[plan] || 0;

  // Mettre à jour le paiement
  await CollectionsManager.paymentCollection.updateOne(
    { paymentId },
    { $set: { status: "SUCCESS", updatedAt: new Date() } },
  );

  // Upgrader l'utilisateur
  await CollectionsManager.userCollection.updateOne(
    { _id: userOid },
    {
      $set: {
        plan,
        planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
        updatedAt: new Date(),
      },
      $inc: { coins },
    },
  );

  // Créer une transaction pour les coins offerts
  if (coins > 0) {
    await CollectionsManager.transactionCollection.insertOne({
      _id: new ObjectId(),
      userId: userOid,
      amount: coins,
      type: "earned",
      description: `Coins offerts — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
      itemType: "subscription",
      metadata: { plan, paymentId },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// ─── Marquer paiement échoué ───
export async function failPayment(paymentId: string) {
  await CollectionsManager.paymentCollection.updateOne(
    { paymentId },
    { $set: { status: "FAILED", updatedAt: new Date() } },
  );
}

// ─── Obtenir le plan actuel de l'utilisateur ───
export async function getUserPlan(userId: ObjectId) {
  const user = await CollectionsManager.userCollection.findOne(
    { _id: userId },
    { projection: { plan: 1, planExpiry: 1, coins: 1 } },
  );

  if (!user) throw new Error("User not found");

  // Vérifier si le plan a expiré
  const plan = user.plan || "free";
  const expired = user.planExpiry && new Date(user.planExpiry) < new Date();

  if (expired && plan !== "free") {
    // Rétrograder automatiquement
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

// ─── Historique des paiements ───
export async function getPaymentHistory(userId: ObjectId) {
  return CollectionsManager.paymentCollection
    .find({ userId, status: "SUCCESS" })
    .sort({ createdAt: -1 })
    .toArray();
}
