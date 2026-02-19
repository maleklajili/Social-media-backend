import { Collection, ObjectId } from "mongodb";
import { ServerRequest } from "../../config/interfaces/i-request";
import { authMiddleware } from "../../middleware/aut-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Message } from "../../models/messages/message";
import type {
  SendMessageInput,
  UpdateMessageInput,
  MarkAsReadInput,
} from "../../models/messages/message.dto";
import { Delete, Get, Post, Patch } from "../../routes/router-manager";
import { BaseController } from "../base/base-controller";
import { MessageRepository } from "../../repositories/messages/message-repository";
import { userRepository } from "../../repositories/user-repository";
import { ResponseHelper } from "../../utils/response-helper";
import { MessageService } from "../../services/message/message-service";
import { TransactionService } from "../../services/transaction-services";
import { TransactionRepository } from "../../repositories/transaction-repository";

export class MessageController extends BaseController<Message, MessageService> {
  constructor() {
    super("/messages");
    this.service = this.createService();
  }

  protected initializeCollection(): Collection<Message> {
    return CollectionsManager.messageCollection;
  }

  protected createService(): MessageService {
    return new MessageService(
      new MessageRepository(),
      new userRepository(),
      new TransactionService(new TransactionRepository(), new userRepository()),
    );
  }

  @Get("/conversation/:userId", [authMiddleware])
  async getConversation(req: ServerRequest): Promise<Response> {
    try {
      const currentUserId = req.user?._id;
      if (!currentUserId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const otherUserId = req.params.userId;
      if (!otherUserId || !ObjectId.isValid(otherUserId)) {
        return ResponseHelper.error("ID de l'autre utilisateur invalide", 400);
      }

      return await this.service.getConversation(
        currentUserId.toString(),
        otherUserId,
      );
    } catch (err) {
      console.error(" Error in getConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/", [authMiddleware])
  async sendMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const body = (await req.json()) as SendMessageInput;

      if (!body.receiverId || !body.type || !body.payload) {
        return ResponseHelper.error(
          "Champs manquants: receiverId, type, payload",
          400,
        );
      }

      return await this.service.sendMessage(userId.toString(), body);
    } catch (err) {
      console.error(" Error in sendMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/media/:receiverId", [authMiddleware])
  async sendMediaMessage(req: ServerRequest): Promise<Response> {
    try {
      console.log("🟢 [Controller] sendMediaMessage appelé");
      console.log("🆔 receiverId param:", req.params.receiverId);

      const userId = req.user?._id;
      console.log("👤 userId du token:", userId?.toString());

      if (!userId) {
        console.error("❌ Utilisateur non authentifié");
        return ResponseHelper.error("Non authentifié", 401);
      }

      const receiverId = req.params.receiverId;
      console.log("🎯 receiverId:", receiverId);

      if (!receiverId || !ObjectId.isValid(receiverId)) {
        console.error("❌ receiverId invalide:", receiverId);
        return ResponseHelper.error("ID du destinataire invalide", 400);
      }

      console.log("📝 Récupération du FormData...");
      const formData = await req.formData();
      console.log("✅ FormData récupéré");

      // Afficher le contenu du FormData
      console.log("📋 Contenu du FormData:");
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(
            `  - ${key}: File (${value.name}, ${value.type}, ${value.size} bytes)`,
          );
        } else {
          console.log(`  - ${key}: ${value}`);
        }
      }

      const result = await this.service.sendMediaMessage(
        userId.toString(),
        receiverId,
        formData as unknown as FormData,
      );

      console.log("✅ [Controller] Résultat reçu du service");
      return result;
    } catch (err) {
      console.error("❌❌❌ ERREUR dans le contrôleur:", err);
      console.error(
        "Stack trace:",
        err instanceof Error ? err.stack : String(err),
      );
      return ResponseHelper.serverError(String(err));
    }
  }

  @Patch("/read", [authMiddleware])
  async markAsRead(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const body = (await req.json()) as MarkAsReadInput;

      if (!Array.isArray(body.messageIds) || body.messageIds.length === 0) {
        return ResponseHelper.error("Liste d'IDs de messages invalide", 400);
      }

      return await this.service.markAsRead(userId.toString(), body.messageIds);
    } catch (err) {
      console.error(" Error in markAsRead:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:messageId", [authMiddleware])
  async deleteMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const messageId = req.params.messageId;
      if (!messageId || !ObjectId.isValid(messageId)) {
        return ResponseHelper.error("ID de message invalide", 400);
      }

      return await this.service.deleteMessage(userId.toString(), messageId);
    } catch (err) {
      console.error(" Error in deleteMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/conversation/:otherUserId", [authMiddleware])
  async deleteConversation(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const otherUserId = req.params.otherUserId;
      if (!otherUserId || !ObjectId.isValid(otherUserId)) {
        return ResponseHelper.error("ID de l'autre utilisateur invalide", 400);
      }

      return await this.service.deleteConversation(
        userId.toString(),
        otherUserId,
      );
    } catch (err) {
      console.error("Error in deleteConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/chats", [authMiddleware])
  async getRecentChats(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      return await this.service.getRecentChats(userId.toString());
    } catch (err) {
      console.error(" Error in getRecentChats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/conversation/:otherUserId/self", [authMiddleware])
  async deleteConversationForSelf(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const otherUserId = req.params.otherUserId;
      if (!otherUserId || !ObjectId.isValid(otherUserId)) {
        return ResponseHelper.error("ID de l'autre utilisateur invalide", 400);
      }

      return await this.service.softDeleteConversationForUser(
        userId.toString(),
        otherUserId,
      );
    } catch (err) {
      console.error("Error in deleteConversationForSelf:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Patch("/:messageId", [authMiddleware])
  async updateMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const messageId = req.params.messageId;
      if (!messageId || !ObjectId.isValid(messageId)) {
        return ResponseHelper.error("ID de message invalide", 400);
      }

      const body = (await req.json()) as UpdateMessageInput;

      if (!body.payload) {
        return ResponseHelper.error("Payload manquant", 400);
      }

      return await this.service.updateMessage(
        userId.toString(),
        messageId,
        body,
      );
    } catch (err) {
      console.error(" Error in updateMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/:messageId/self", [authMiddleware])
  async softDeleteMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const messageId = req.params.messageId;
      if (!messageId || !ObjectId.isValid(messageId)) {
        return ResponseHelper.error("ID de message invalide", 400);
      }

      return await this.service.softDeleteMessage(userId.toString(), messageId);
    } catch (err) {
      console.error("Error in softDeleteMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
