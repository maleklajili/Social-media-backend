// controllers/message.controller.ts
import { Collection, ObjectId } from "mongodb";
import { ServerRequest } from "../../config/interfaces/i-request";
import { authMiddleware } from "../../middleware/aut-middleware";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Message } from "../../models/messages/message";
import type {
  SendMessageInput,
  UpdateMessageInput,
} from "../../models/messages/message.dto";
import type { MarkAsReadInput } from "../../models/messages/message.dto";

import { Delete, Get, Post, Patch } from "../../routes/router-manager";
import { BaseController } from "../base/base-controller";
import { MessageRepository } from "../../repositories/messages/message-repository";
import { userRepository } from "../../repositories/user-repository";
import { ResponseHelper } from "../../utils/response-helper";
import { MessageService } from "../../services/message/message-service";

export class MessageController extends BaseController<Message, MessageService> {
  constructor() {
    super("/messages");
    this.service = this.createService();
  }

  protected initializeCollection(): Collection<Message> {
    return CollectionsManager.messageCollection;
  }

  protected createService(): MessageService {
    return new MessageService(new MessageRepository(), new userRepository());
  }

  /**
   * GET /messages/conversation/:userId
   * Récupère toute la conversation avec un autre utilisateur (sans pagination)
   */
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

      // Appel sans limite ni before → récupère tous les messages
      return await this.service.getConversation(
        currentUserId.toString(),
        otherUserId,
      );
    } catch (err) {
      console.error(" Error in getConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * POST /messages
   * Envoie un message (texte, image, vidéo, document)
   */
  @Post("/", [authMiddleware])
  async sendMessage(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      const bodyUnknown = await req.json();
      const body = bodyUnknown as SendMessageInput;

      // Vérification runtime
      if (!body.receiverId || !body.type || !body.payload) {
        return ResponseHelper.error(
          "Champs manquants: receiverId, type, payload",
          400,
        );
      }

      // Appel au service avec types sécurisés
      return await this.service.sendMessage(userId.toString(), body);
    } catch (err) {
      console.error(" Error in sendMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * PATCH /messages/read
   * Marque des messages comme lus
   */
  @Patch("/read", [authMiddleware])
  async markAsRead(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return ResponseHelper.error("Non authentifié", 401);
      }

      // 1️⃣ Lire le body (unknown)
      const bodyUnknown = await req.json();

      if (
        typeof bodyUnknown !== "object" ||
        bodyUnknown === null ||
        !("messageIds" in bodyUnknown)
      ) {
        return ResponseHelper.error("Liste d'IDs de messages invalide", 400);
      }

      // 3️⃣ Cast sécurisé vers notre DTO
      const body = bodyUnknown as MarkAsReadInput;

      // 4️⃣ Vérification que messageIds est bien un tableau non vide
      if (!Array.isArray(body.messageIds) || body.messageIds.length === 0) {
        return ResponseHelper.error("Liste d'IDs de messages invalide", 400);
      }

      // 5️⃣ Appel au service
      return await this.service.markAsRead(userId.toString(), body.messageIds);
    } catch (err) {
      console.error(" Error in markAsRead:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * DELETE /messages/:messageId
   * Supprime un message spécifique
   */
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

  /**
   * DELETE /messages/conversation/:otherUserId
   * Supprime toute la conversation avec un autre utilisateur
   */
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

  /**
   * GET /messages/chats
   * Récupère la liste des dernières conversations
   */
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

  //supprime tous conversation
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

  /**
   * PATCH /messages/:messageId
   * Modifie un message existant (seul l'expéditeur peut modifier)
   */
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

      const bodyUnknown = await req.json();
      const body = bodyUnknown as UpdateMessageInput;

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
  //supprimer message pour moi
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
