// services/message/message.service.ts
import { ObjectId } from "mongodb";
import { MessageRepository } from "../../repositories/messages/message-repository";

import { ResponseHelper } from "../../utils/response-helper";
import { MessageType, type Message } from "../../models/messages/message";
import type { MessagePayload } from "../../models/messages/message";
import type {
  SendMessageInput,
  MessageResponse,
  UpdateMessageInput,
} from "../../models/messages/message.dto";
import type { IMessageService } from "../../interfaces/message/i-message-service";
import type { User } from "../../models/user";
import type { userRepository } from "../../repositories/user-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import { BaseService } from "../base/base-service";

export class MessageService
  extends BaseService<Message>
  implements IMessageService
{
  constructor(
    private messageRepo: MessageRepository,
    private userRepo: userRepository,
  ) {
    super(CollectionsManager.messageCollection); // nécessaire pour BaseService
  }

  /**
   * Envoyer un message (texte, image, vidéo, document)
   */
  async sendMessage(
    senderId: string,
    input: SendMessageInput,
  ): Promise<Response> {
    try {
      const sender = await this.userRepo.findById(new ObjectId(senderId));
      if (!sender) {
        return ResponseHelper.error("Expéditeur introuvable", 404);
      }

      const receiver = await this.userRepo.findById(
        new ObjectId(input.receiverId),
      );
      if (!receiver) {
        return ResponseHelper.error("Destinataire introuvable", 404);
      }

      const validationError = this.validatePayload(input.type, input.payload);
      if (validationError) {
        return ResponseHelper.error(validationError, 400);
      }

      const message: Message = {
        _id: new ObjectId(),
        sender: new ObjectId(senderId),
        receiver: new ObjectId(input.receiverId),
        type: input.type,
        payload: input.payload,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.messageRepo.sendMessage(message);

      const response = this.formatMessageResponse(message, sender, receiver);
      return ResponseHelper.success(response);
    } catch (err) {
      console.error(" Error in sendMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Récupérer la conversation entre deux utilisateurs
   */
  async getConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Response> {
    try {
      // 1️⃣ Récupérer les messages
      const messages = await this.messageRepo.getConversation(
        new ObjectId(userId),
        new ObjectId(otherUserId),
        new ObjectId(userId),
      );

      if (!messages.length) {
        return ResponseHelper.success([]);
      }

      // 2️⃣ Récupérer les IDs uniques des users
      const userIds = new Set<string>();
      messages.forEach((m) => {
        userIds.add(m.sender.toString());
        userIds.add(m.receiver.toString());
      });

      // 3️⃣ Charger les users en une seule requête
      const users = await this.userRepo.findByIds(
        Array.from(userIds).map((id) => new ObjectId(id)),
      );

      const userMap: Map<string, User> = new Map(
        users.map((u: User) => [u._id!.toString(), u]),
      );

      // 5️⃣ Formatter les messages avec vérification safe
      const formattedMessages = messages.map((msg) => {
        const sender = userMap.get(msg.sender.toString());
        const receiver = userMap.get(msg.receiver.toString());

        if (!sender || !receiver) {
          throw new Error("Utilisateur introuvable lors du formatage");
        }

        return this.formatMessageResponse(msg, sender, receiver);
      });

      return ResponseHelper.success(formattedMessages);
    } catch (err) {
      console.error(" Error in getConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async softDeleteConversationForUser(
    userId: string,
    otherUserId: string,
  ): Promise<Response> {
    try {
      const count = await this.messageRepo.softDeleteConversationForUser(
        new ObjectId(userId),
        new ObjectId(otherUserId),
        new ObjectId(userId),
      );
      return ResponseHelper.success({
        message: `${count} messages masqués pour vous`,
        modifiedCount: count,
      });
    } catch (err) {
      console.error("Error in softDeleteConversationForUser:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Marquer des messages comme lus
   */
  async markAsRead(userId: string, messageIds: string[]): Promise<Response> {
    try {
      const objectIds = messageIds.map((id) => new ObjectId(id));

      // Vérification que l'utilisateur est bien le destinataire
      const messages = await this.messageRepo.findMessagesByIds(objectIds);
      const unauthorized = messages.some(
        (msg) => msg.receiver.toString() !== userId,
      );
      if (unauthorized) {
        return ResponseHelper.error(
          "Vous ne pouvez marquer comme lus que vos propres messages reçus",
          403,
        );
      }

      await this.messageRepo.markAsRead(objectIds);
      return ResponseHelper.success({ success: true });
    } catch (err) {
      console.error(" Error in markAsRead:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Supprimer un message (seulement si l'utilisateur est l'expéditeur)
   */
  async deleteMessage(userId: string, messageId: string): Promise<Response> {
    try {
      const deleted = await this.messageRepo.deleteMessage(
        new ObjectId(messageId),
        new ObjectId(userId),
      );

      if (!deleted) {
        return ResponseHelper.error(
          "Message introuvable ou vous n'êtes pas l'expéditeur",
          404,
        );
      }

      return ResponseHelper.success({ message: "Message supprimé" });
    } catch (err) {
      console.error(" Error in deleteMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateMessage(
    userId: string,
    messageId: string,
    input: UpdateMessageInput,
  ): Promise<Response> {
    try {
      const message = await this.messageRepo.getMessageById(
        new ObjectId(messageId),
      );
      if (!message) {
        return ResponseHelper.error("Message introuvable", 404);
      }

      // Vérifier que l'utilisateur est l'expéditeur
      if (message.sender.toString() !== userId) {
        return ResponseHelper.error(
          "Vous n'êtes pas l'auteur de ce message",
          403,
        );
      }

      // ⛔ INTERDIRE LA MODIFICATION SI LE MESSAGE A ÉTÉ LU
      if (message.read) {
        return ResponseHelper.error(
          "Impossible de modifier un message déjà lu",
          403,
        );
      }

      const validationError = this.validatePayload(message.type, input.payload);
      if (validationError) {
        return ResponseHelper.error(validationError, 400);
      }

      const updated = await this.messageRepo.updateMessage(
        new ObjectId(messageId),
        new ObjectId(userId),
        input.payload,
      );

      if (!updated) {
        return ResponseHelper.error("Échec de la mise à jour", 500);
      }

      const updatedMessage = await this.messageRepo.getMessageById(
        new ObjectId(messageId),
      );
      if (!updatedMessage) {
        return ResponseHelper.error(
          "Message introuvable après mise à jour",
          404,
        );
      }

      const sender = await this.userRepo.findById(new ObjectId(userId));
      const receiver = await this.userRepo.findById(updatedMessage.receiver);
      if (!sender || !receiver) {
        return ResponseHelper.error("Utilisateur introuvable", 404);
      }

      const response = this.formatMessageResponse(
        updatedMessage,
        sender,
        receiver,
      );
      return ResponseHelper.success(response);
    } catch (err) {
      console.error(" Error in updateMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  /**
   * Supprimer toute une conversation entre deux utilisateurs
   */
  async deleteConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Response> {
    try {
      const count = await this.messageRepo.deleteConversation(
        new ObjectId(userId),
        new ObjectId(otherUserId),
      );

      return ResponseHelper.success({ deletedCount: count });
    } catch (err) {
      console.error(" Error in deleteConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Récupérer les derniers messages avec chaque contact (liste des discussions)
   */
  async getRecentChats(userId: string): Promise<Response> {
    try {
      const currentUserId = new ObjectId(userId);
      // Récupère le dernier message de chaque conversation
      const messages = await this.messageRepo.getRecentChats(currentUserId);

      if (!messages.length) {
        return ResponseHelper.success([]);
      }

      const result = [];

      for (const msg of messages) {
        // Détermine l'ID de l'interlocuteur
        const otherUserId =
          msg.sender.toString() === userId ? msg.receiver : msg.sender;

        // Récupère l'utilisateur interlocuteur
        const otherUser = await this.userRepo.findById(otherUserId);
        if (!otherUser) continue;

        // Compte les messages non lus de cette conversation (envoyés par l'autre et non lus par l'utilisateur)
        const unreadCount = await this.messageRepo.countUnreadMessages(
          currentUserId,
          otherUserId,
        );

        // Récupère l'expéditeur et le destinataire du dernier message pour le formater
        const sender =
          msg.sender.toString() === userId
            ? await this.userRepo.findById(currentUserId)
            : otherUser;
        const receiver =
          msg.receiver.toString() === userId
            ? await this.userRepo.findById(currentUserId)
            : otherUser;

        if (!sender || !receiver) continue;

        const formattedMessage = this.formatMessageResponse(
          msg,
          sender,
          receiver,
        );

        result.push({
          user: {
            _id: otherUser._id!.toString(),
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            userName: otherUser.userName,
            image: otherUser.image,
          },
          lastMessage: formattedMessage,
          unreadCount,
        });
      }

      // Trie par date du dernier message (plus récent en premier)
      result.sort(
        (a, b) =>
          b.lastMessage.createdAt!.getTime() -
          a.lastMessage.createdAt!.getTime(),
      );

      return ResponseHelper.success(result);
    } catch (err) {
      console.error("Error in getRecentChats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Supprimer tous les messages d'un utilisateur (admin ou suppression de compte)
   */
  async deleteAllMessagesByUser(userId: string): Promise<Response> {
    try {
      const count = await this.messageRepo.deleteAllMessagesByUser(
        new ObjectId(userId),
      );
      return ResponseHelper.success({ deletedCount: count });
    } catch (err) {
      console.error(" Error in deleteAllMessagesByUser:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // ------------------------- Méthodes privées -------------------------
  private validatePayload(
    type: MessageType,
    payload: MessagePayload,
  ): string | null {
    switch (type) {
      case MessageType.TEXT:
        if ("text" in payload) {
          if (typeof payload.text !== "string" || payload.text.trim() === "") {
            return "Le texte du message est invalide ou vide";
          }
        } else {
          return "Payload text manquant";
        }
        break;

      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.DOCUMENT:
        if ("url" in payload && "mimeType" in payload) {
          if (typeof payload.url !== "string" || payload.url.trim() === "") {
            return "URL requise pour les médias";
          }
          if (
            typeof payload.mimeType !== "string" ||
            payload.mimeType.trim() === ""
          ) {
            return "Type MIME requis";
          }
        } else {
          return "Payload média invalide";
        }
        break;

      default:
        return "Type de message inconnu";
    }
    return null;
  }

  private formatMessageResponse(
    message: Message,
    sender: User,
    receiver: User,
  ): MessageResponse {
    return {
      _id: message._id!.toString(),
      sender: {
        _id: sender._id!.toString(),
        firstName: sender.firstName,
        lastName: sender.lastName,
        userName: sender.userName,
        image: sender.image,
      },
      receiver: {
        _id: receiver._id!.toString(),
        firstName: receiver.firstName,
        lastName: receiver.lastName,
        userName: receiver.userName,
        image: receiver.image,
      },
      type: message.type,
      payload: message.payload,
      read: message.read,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  async softDeleteMessage(
    userId: string,
    messageId: string,
  ): Promise<Response> {
    try {
      const message = await this.messageRepo.getMessageById(
        new ObjectId(messageId),
      );
      if (!message) {
        return ResponseHelper.error("Message introuvable", 404);
      }
      // On permet à l'expéditeur ou au destinataire de masquer le message
      if (
        message.sender.toString() !== userId &&
        message.receiver.toString() !== userId
      ) {
        return ResponseHelper.error(
          "Vous n'êtes pas concerné par ce message",
          403,
        );
      }
      const updated = await this.messageRepo.softDeleteMessage(
        new ObjectId(messageId),
        new ObjectId(userId),
      );
      if (!updated) {
        return ResponseHelper.error("Message déjà masqué ou introuvable", 400);
      }
      return ResponseHelper.success({ message: "Message masqué pour vous" });
    } catch (err) {
      console.error("Error in softDeleteMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
