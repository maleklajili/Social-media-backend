import { ObjectId } from "mongodb";
import { authMiddleware } from "../middleware/aut-middleware";
import type { ServerRequest } from "../config/interfaces/i-request";
import { Get, Post, Put } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import {
  createTransferPayment,
  approvePayment,
  rejectPayment,
  getPendingPayments,
  getUserPlan,
  getPaymentStatus,
  getPaymentHistory,
  BANK_INFO,
} from "../services/payment-service";
import type { PlanType } from "../models/payment";
import { UPLOAD_PATHS } from "../config/config";
import { handleFileUpload, type UploadResult } from "../utils/upload-helper";

export class PaymentController {
  // ─── Initier un paiement par virement bancaire ───
  @Post("/payment/initiate", [authMiddleware])
  async initiate(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }

      const formData = (await req.formData()) as unknown as FormData;
      const plan = formData.get("plan") as PlanType;

      if (!plan || !["pro", "gold"].includes(plan)) {
        return ResponseHelper.error("Plan must be 'pro' or 'gold'");
      }

      // Upload de la preuve de virement
      const storePath = `${UPLOAD_PATHS.documents}-${req.user._id}/payments`;
      const result = (await handleFileUpload(formData, {
        fieldName: "transferProof",
        storePath,
        fileName: `transfer_${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId: req.user._id,
      })) as UploadResult;

      if (!result?.fileName) {
        return ResponseHelper.error(
          "La preuve de virement est requise (image ou PDF)",
          400,
        );
      }

      const payment = await createTransferPayment(
        req.user._id,
        plan,
        result.fileName,
      );

      return ResponseHelper.success({
        paymentId: payment._id,
        status: payment.status,
        message:
          "Demande de paiement envoyée. Votre virement sera vérifié sous 24-48h.",
      });
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Infos bancaires pour le virement ───
  @Get("/payment/bank-info", [authMiddleware])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBankInfo(_req: ServerRequest): Promise<Response> {
    return ResponseHelper.success(BANK_INFO);
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

  // ─── Vérifier le statut d'un paiement ───
  @Get("/payment/status/:paymentId", [authMiddleware])
  async status(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }
      const { paymentId } = req.params;
      if (!paymentId || !ObjectId.isValid(paymentId)) {
        return ResponseHelper.error("Payment ID invalide");
      }
      const result = await getPaymentStatus(new ObjectId(paymentId));
      return ResponseHelper.success(result);
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

  // ─── Admin : paiements en attente ───
  @Get("/payment/pending", [authMiddleware])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async pending(_req: ServerRequest): Promise<Response> {
    try {
      const payments = await getPendingPayments();
      return ResponseHelper.success(payments);
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Admin : approuver un paiement ───
  @Put("/payment/:paymentId/approve", [authMiddleware])
  async approve(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }
      const { paymentId } = req.params;
      if (!paymentId || !ObjectId.isValid(paymentId)) {
        return ResponseHelper.error("Payment ID invalide");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await req.json()) as any;
      const result = await approvePayment(
        new ObjectId(paymentId),
        req.user._id,
        body?.note,
      );
      return ResponseHelper.success(result);
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }

  // ─── Admin : rejeter un paiement ───
  @Put("/payment/:paymentId/reject", [authMiddleware])
  async reject(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("User not authenticated", 401);
      }
      const { paymentId } = req.params;
      if (!paymentId || !ObjectId.isValid(paymentId)) {
        return ResponseHelper.error("Payment ID invalide");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await req.json()) as any;
      const result = await rejectPayment(
        new ObjectId(paymentId),
        req.user._id,
        body?.note,
      );
      return ResponseHelper.success(result);
    } catch (err) {
      return ResponseHelper.error(String(err), 500);
    }
  }
}
