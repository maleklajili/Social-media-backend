import { ObjectId } from "mongodb";
import { authMiddleware } from "../middleware/aut-middleware";
import type { ServerRequest } from "../config/interfaces/i-request";
import { Get, Post } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import {
  createFlouciPayment,
  verifyFlouciPayment,
  savePaymentIntent,
  activatePlan,
  failPayment,
  getUserPlan,
  getPaymentHistory,
} from "../services/payment-service";
import type { PlanType } from "../models/payment";

export class PaymentController {
  // ─── Initier un paiement ───
  @Post("/payment/initiate", [authMiddleware])
  async initiate(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const body = (await req.json()) as Record<string, unknown>;
      const plan = body?.plan as PlanType;

      if (!plan || !["pro", "gold"].includes(plan)) {
        return ResponseHelper.error("Plan must be 'pro' or 'gold'");
      }

      const userId = req.user._id.toString();
      const result = await createFlouciPayment(plan, userId);

      // Sauvegarder l'intention de paiement
      await savePaymentIntent(
        new ObjectId(userId),
        result.paymentId,
        plan,
        result.trackingId,
      );

      return ResponseHelper.success({
        paymentUrl: result.link,
        paymentId: result.paymentId,
      });
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Callback succès Flouci (redirige vers deep link Flutter) ───
  @Get("/payment/success")
  async success(req: ServerRequest): Promise<Response> {
    try {
      const paymentId = req.query.payment_id as string;
      const userId = req.query.userId as string;
      const plan = req.query.plan as PlanType;

      if (!paymentId || !userId || !plan) {
        return Response.redirect("cvbuilder://payment/fail");
      }

      const result = await verifyFlouciPayment(paymentId);

      if (result?.status === "SUCCESS") {
        await activatePlan(userId, plan, paymentId);
        return Response.redirect(
          `cvbuilder://payment/success?plan=${encodeURIComponent(plan)}`,
        );
      }

      await failPayment(paymentId);
      return Response.redirect("cvbuilder://payment/fail");
    } catch {
      return Response.redirect("cvbuilder://payment/fail");
    }
  }

  // ─── Callback échec Flouci ───
  @Get("/payment/fail")
  async fail(_req: ServerRequest): Promise<Response> {
    return Response.redirect("cvbuilder://payment/fail");
  }

  // ─── Plan actuel de l'utilisateur ───
  @Get("/payment/plan", [authMiddleware])
  async getPlan(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const planInfo = await getUserPlan(req.user._id);
      return ResponseHelper.success(planInfo);
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Vérifier un paiement (polling depuis Flutter) ───
  @Get("/payment/verify/:paymentId", [authMiddleware])
  async verify(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const { paymentId } = req.params;
      if (!paymentId) {
        return ResponseHelper.error("Payment ID required");
      }

      const result = await verifyFlouciPayment(paymentId);
      return ResponseHelper.success({ status: result?.status || "UNKNOWN" });
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Historique des paiements ───
  @Get("/payment/history", [authMiddleware])
  async history(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const payments = await getPaymentHistory(req.user._id);
      return ResponseHelper.success(payments);
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }
}
