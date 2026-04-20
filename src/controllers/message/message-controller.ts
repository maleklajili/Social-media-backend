import { Collection, ObjectId } from "mongodb";
import { ServerRequest } from "../../config/interfaces/i-request";
import { authMiddleware } from "../../middleware/aut-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Message } from "../../models/messages/message";
import { MessageType } from "../../models/messages/message";

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
      const userId = req.user?._id;

      if (!userId) {
        console.error(" Utilisateur non authentifié");
        return ResponseHelper.error("Non authentifié", 401);
      }

      const receiverId = req.params.receiverId;

      if (!receiverId || !ObjectId.isValid(receiverId)) {
        console.error(" receiverId invalide:", receiverId);
        return ResponseHelper.error("ID du destinataire invalide", 400);
      }

      const formData = await req.formData();

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

      return result;
    } catch (err) {
      console.error("ERREUR dans le contrôleur:", err);
      console.error(
        "Stack trace:",
        err instanceof Error ? err.stack : String(err),
      );
      return ResponseHelper.serverError(String(err));
    }
  }

  @Post("/groups/:groupId/leave", [authMiddleware])
  async leaveGroup(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const groupId = req.params.groupId;
      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("ID de groupe invalide", 400);
      }

      return await this.service.leaveGroup(userId.toString(), groupId);
    } catch (err) {
      console.error("❌ Error in leaveGroup:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  // Dans MessageController.ts, ajoutez ces méthodes :

  @Delete("/groups/:groupId/messages/:messageId", [authMiddleware])
  async deleteGroupMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const messageId = req.params.messageId;
      if (!messageId || !ObjectId.isValid(messageId)) {
        return ResponseHelper.error("ID de message invalide", 400);
      }

      return await this.service.deleteGroupMessage(
        userId.toString(),
        messageId,
      );
    } catch (err) {
      console.error("❌ Error in deleteGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Patch("/groups/:groupId/messages/:messageId", [authMiddleware])
  async updateGroupMessage(req: ServerRequest): Promise<Response> {
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

      return await this.service.updateGroupMessage(
        userId.toString(),
        messageId,
        body,
      );
    } catch (err) {
      console.error("❌ Error in updateGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Delete("/groups/:groupId/messages/:messageId/self", [authMiddleware])
  async softDeleteGroupMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const messageId = req.params.messageId;
      if (!messageId || !ObjectId.isValid(messageId)) {
        return ResponseHelper.error("ID de message invalide", 400);
      }

      return await this.service.softDeleteGroupMessage(
        userId.toString(),
        messageId,
      );
    } catch (err) {
      console.error("❌ Error in softDeleteGroupMessage:", err);
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
  @Post("/groups/:groupId/media", [authMiddleware])
  async sendMediaGroupMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const groupId = req.params.groupId;
      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("ID de groupe invalide", 400);
      }

      const formData = await req.formData();
      const mediaType = formData.get("type") as string;

      if (
        !mediaType ||
        !Object.values(MessageType).includes(mediaType as MessageType)
      ) {
        return ResponseHelper.error("Type de média invalide", 400);
      }

      return await this.service.sendMediaGroupMessage(
        userId.toString(),
        groupId,
        formData as unknown as FormData,
        mediaType as MessageType,
      );
    } catch (err) {
      console.error(" Error in sendMediaGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  @Post("/groups/:groupId", [authMiddleware])
  async sendGroupMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const groupId = req.params.groupId;
      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("ID de groupe invalide", 400);
      }

      const body = (await req.json()) as { text: string };

      const { text } = body;
      if (!text || typeof text !== "string") {
        return ResponseHelper.error("Le message est requis", 400);
      }

      return await this.service.sendGroupMessage(userId.toString(), {
        groupId,
        text,
      });
    } catch (err) {
      console.error(" Error in sendGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  @Delete("/groups/:groupId/self", [authMiddleware])
  async deleteGroupConversationForSelf(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      const groupId = req.params.groupId;
      if (!userId || !groupId)
        return ResponseHelper.error("Paramètres invalides", 400);
      return await this.service.softDeleteGroupConversationForUser(
        userId.toString(),
        groupId,
      );
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/groups/recent", [authMiddleware])
  async getGroupConversationsList(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }
      return await this.service.getGroupConversationsList(userId.toString());
    } catch (err) {
      console.error(" Error in getGroupConversationsList:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/groups/:groupId", [authMiddleware])
  async getGroupConversation(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) return ResponseHelper.error("Non authentifié", 401);

      const groupId = req.params.groupId;
      if (!groupId || !ObjectId.isValid(groupId)) {
        return ResponseHelper.error("ID de groupe invalide", 400);
      }

      return await this.service.getGroupConversation(
        userId.toString(),
        groupId,
      );
    } catch (err) {
      console.error(" Error in getGroupConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  @Get("/search", [authMiddleware])
  async searchMessages(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const url = new URL(req.url);
      const query = url.searchParams.get("q");

      if (!query) {
        return ResponseHelper.error("Paramètre de recherche 'q' manquant", 400);
      }

      return await this.service.searchMessages(userId.toString(), query);
    } catch (err) {
      console.error(" Error in searchMessages:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
