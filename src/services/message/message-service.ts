import { ObjectId } from "mongodb";
import { MessageRepository } from "../../repositories/messages/message-repository";
import { ResponseHelper } from "../../utils/response-helper";
import {
  MessageType,
  type Message,
  type MediaPayload,
  type TextPayload,
} from "../../models/messages/message";
import type {
  SendMessageInput,
  MessageResponse,
  UpdateMessageInput,
} from "../../models/messages/message.dto";
import type { IMessageService } from "../../interfaces/message/i-message-service";
import type { User } from "../../models/user";
import { userRepository } from "../../repositories/user-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import { BaseService } from "../base/base-service";
import { getIo } from "../../socket/socket-manager";
import { FileService } from "../../utils/file-service";
import path from "path";
import { handleFileUpload, type UploadResult } from "../../utils/upload-helper";
import { UPLOAD_PATHS } from "../../config/config";
import { COINS_CONFIG } from "../../utils/coins-config";
import type { TransactionService } from "../transaction-services";

// Types pour les événements Socket.IO
interface MessageDeletedEvent {
  messageId: string;
  deletedBy: string;
}

interface MessagesReadEvent {
  messageIds: string[];
  readerId: string;
}

interface ConversationViewedEvent {
  userId: string;
  otherUserId: string;
  viewedAt: Date;
}

interface ConversationDeletedEvent {
  otherUserId: string;
  deletedCount: number;
}

interface ConversationSoftDeletedEvent {
  otherUserId: string;
  modifiedCount: number;
}

interface MessageSoftDeletedEvent {
  messageId: string;
  userId: string;
}

interface RecentChatsEmptyEvent {
  userId: string;
  timestamp: Date;
}

interface RecentChatsErrorEvent {
  userId: string;
  error: string;
  timestamp: Date;
}

interface AllMessagesDeletedEvent {
  userId: string;
  deletedCount: number;
  timestamp: Date;
}

interface ChatPreviewUpdatedEvent {
  otherUserId: string;
  lastMessage: MessageResponse;
  unreadCount: number;
  timestamp: Date;
}

interface RecentChatsUpdatedEvent {
  userId: string;
  chats: Array<{
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      userName: string;
      image?: string;
    };
    lastMessage: MessageResponse;
    unreadCount: number;
  }>;
  timestamp: Date;
  totalUnread: number;
}

export class MessageService
  extends BaseService<Message>
  implements IMessageService
{
  constructor(
    private messageRepo: MessageRepository,
    private userRepo: userRepository,
    private transactionService?: TransactionService,
  ) {
    super(CollectionsManager.messageCollection);
  }

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

      if (this.transactionService) {
        try {
          await this.userRepo.addCoins(
            new ObjectId(senderId),
            COINS_CONFIG.SEND_MESSAGE,
          );
          await this.transactionService.addStandardEarning(
            new ObjectId(senderId),
            COINS_CONFIG.SEND_MESSAGE,
            "message",
            message._id!,
            "Envoi d'un message texte",
            {
              receiverId: input.receiverId,
            },
          );
        } catch (err) {
          console.error("Erreur lors de l'ajout de coins:", err);
        }
      }

      const response = this.formatMessageResponse(message, sender, receiver);
      this.emitNewMessage(senderId, input.receiverId, response);

      return ResponseHelper.success(response);
    } catch (err) {
      console.error("❌ Error in sendMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async sendMediaMessage(
    senderId: string,
    receiverId: string,
    formData: FormData,
  ): Promise<Response> {
    try {
      console.log("🔵 [sendMediaMessage] Début de la méthode");
      console.log("📤 senderId:", senderId);
      console.log("📥 receiverId:", receiverId);

      const sender = await this.userRepo.findById(new ObjectId(senderId));
      const receiver = await this.userRepo.findById(new ObjectId(receiverId));

      console.log("👤 sender trouvé:", !!sender);
      console.log("👤 receiver trouvé:", !!receiver);

      if (!sender || !receiver) {
        console.error("❌ Expéditeur ou destinataire introuvable");
        return ResponseHelper.error(
          "Expéditeur ou destinataire introuvable",
          404,
        );
      }

      // Afficher toutes les clés du FormData
      console.log("📋 Clés disponibles dans FormData:");
      const formDataKeys: string[] = [];
      for (const key of formData.keys()) {
        formDataKeys.push(key);
      }
      console.log("Keys:", formDataKeys);

      const mediaType = formData.get("type") as string | null;
      console.log("🎯 mediaType reçu:", mediaType);
      console.log("📋 MessageType values:", Object.values(MessageType));

      if (!mediaType) {
        console.error("❌ mediaType est null ou undefined");
        return ResponseHelper.error("Type de média invalide ou manquant", 400);
      }

      if (!Object.values(MessageType).includes(mediaType as MessageType)) {
        console.error(`❌ mediaType "${mediaType}" n'est pas valide`);
        console.log("✅ Types valides:", Object.values(MessageType));
        return ResponseHelper.error("Type de média invalide ou manquant", 400);
      }

      const typedMediaType = mediaType as MessageType;
      console.log("✅ typedMediaType:", typedMediaType);

      const basePath = UPLOAD_PATHS.images.replace("./", "");
      const storePath = `${basePath}-${senderId}/${UPLOAD_PATHS.messages}`;
      console.log("📁 storePath:", storePath);

      // Vérifier si le fichier existe dans le FormData
      const fileCheck = formData.get("file");
      console.log("📎 file présent:", !!fileCheck);
      if (fileCheck) {
        console.log("📎 type du fichier:", fileCheck.constructor.name);
        console.log("📎 instanceOf File:", fileCheck instanceof File);
      }

      const uploadResult = (await handleFileUpload(formData, {
        fieldName: "file",
        storePath,
        fileName: `message-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId: new ObjectId(senderId),
      })) as UploadResult;

      console.log("📦 uploadResult:", uploadResult);

      if (!uploadResult) {
        console.error("❌ uploadResult est null ou undefined");
        return ResponseHelper.error("Erreur lors de l'upload du fichier", 500);
      }

      if (!uploadResult.fileName) {
        console.error("❌ uploadResult.fileName est manquant");
        return ResponseHelper.error("Nom de fichier manquant", 500);
      }

      console.log("📄 uploadResult.fileName:", uploadResult.fileName);
      console.log("📄 uploadResult.size:", uploadResult.size);

      // ✅ SOLUTION: Utiliser l'extension du fichier pour déterminer le type MIME
      // au lieu de uploadResult.mimeType qui peut être undefined ou mal formaté
      const fileExtension = path.extname(uploadResult.fileName).toLowerCase();
      const mimeTypeFromExt = this.getMimeTypeFromFileName(
        uploadResult.fileName,
      );

      console.log("🔍 extension du fichier:", fileExtension);
      console.log("🔍 mimeType depuis extension:", mimeTypeFromExt);

      // ✅ Valider le type MIME basé sur l'extension
      const allowedTypes = this.getAllowedMimeTypes(typedMediaType);
      console.log("✅ allowedTypes pour", typedMediaType, ":", allowedTypes);
      console.log(
        "🔍 allowedTypes includes mimeTypeFromExt:",
        allowedTypes.includes(mimeTypeFromExt),
      );

      if (!allowedTypes.includes(mimeTypeFromExt)) {
        console.error(
          `❌ Type de fichier "${fileExtension}" non autorisé pour ${typedMediaType}`,
        );
        return ResponseHelper.error(
          `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(", ")}`,
          400,
        );
      }

      const maxSize = this.getMaxSize(typedMediaType);
      console.log("📊 maxSize pour", typedMediaType, ":", maxSize, "bytes");

      if (uploadResult.size && uploadResult.size > maxSize) {
        const sizeMB = (uploadResult.size / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        console.error(`❌ Taille ${sizeMB}MB > max ${maxSizeMB}MB`);
        return ResponseHelper.error(
          `Fichier trop volumineux (${sizeMB} MB). Taille max: ${maxSizeMB} MB`,
          400,
        );
      }

      const baseUrl =
        process.env.BASE_URL || `http://localhost:${process.env.PORT || 9000}`;
      const cleanPath = storePath.replace(/^\.\//, "");
      const fileUrl = `${baseUrl}/${cleanPath}/${uploadResult.fileName}`;
      console.log("🔗 fileUrl généré:", fileUrl);

      // ✅ Utiliser le mimeType basé sur l'extension pour le payload
      const payload: MediaPayload = {
        url: fileUrl,
        mimeType: mimeTypeFromExt, // Maintenant toujours défini !
        size: uploadResult.size,
        fileName: this.extractFileName(uploadResult.fileName),
      };
      console.log("📦 payload créé:", payload);

      const message: Message = {
        _id: new ObjectId(),
        sender: new ObjectId(senderId),
        receiver: new ObjectId(receiverId),
        type: typedMediaType,
        payload,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("💾 Sauvegarde du message en base...");
      await this.messageRepo.sendMessage(message);
      console.log("✅ Message sauvegardé avec ID:");

      if (this.transactionService) {
        try {
          const coinsAmount = this.getCoinsForMessageType(typedMediaType);
          console.log("💰 Ajout de coins:", coinsAmount);
          await this.userRepo.addCoins(new ObjectId(senderId), coinsAmount);
          await this.transactionService.addStandardEarning(
            new ObjectId(senderId),
            coinsAmount,
            "message",
            message._id!,
            `Envoi d'un message ${typedMediaType}`,
            {
              type: typedMediaType,
              receiverId,
              fileName: uploadResult.fileName,
            },
          );
          console.log("✅ Coins ajoutés avec succès");
        } catch (err) {
          console.error("❌ Erreur lors de l'ajout de coins:", err);
        }
      }

      const response = this.formatMessageResponse(message, sender, receiver);
      console.log("📤 Émission socket.io...");
      this.emitNewMessage(senderId, receiverId, response);
      console.log("✅ Méthode terminée avec succès");

      return ResponseHelper.success(response);
    } catch (err) {
      console.error("❌❌❌ ERREUR CATASTROPHIQUE dans sendMediaMessage:", err);
      console.error(
        "Stack trace:",
        err instanceof Error ? err.stack : String(err),
      );
      return ResponseHelper.serverError(String(err));
    }
  }
  async getConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Response> {
    try {
      const messages = await this.messageRepo.getConversation(
        new ObjectId(userId),
        new ObjectId(otherUserId),
        new ObjectId(userId),
      );

      if (!messages.length) {
        return ResponseHelper.success([]);
      }

      const userIds = new Set<string>();
      messages.forEach((m) => {
        userIds.add(m.sender.toString());
        userIds.add(m.receiver.toString());
      });

      const users = await this.userRepo.findByIds(
        Array.from(userIds).map((id) => new ObjectId(id)),
      );

      const userMap = new Map<string, User>(
        users.map((u: User) => [u._id!.toString(), u]),
      );

      const formattedMessages = messages.map((msg) => {
        const sender = userMap.get(msg.sender.toString());
        const receiver = userMap.get(msg.receiver.toString());

        if (!sender || !receiver) {
          throw new Error("Utilisateur introuvable lors du formatage");
        }

        return this.formatMessageResponse(msg, sender, receiver);
      });

      this.emitConversationViewed(userId, otherUserId);

      return ResponseHelper.success(formattedMessages);
    } catch (err) {
      console.error("❌ Error in getConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async markAsRead(userId: string, messageIds: string[]): Promise<Response> {
    try {
      const objectIds = messageIds.map((id) => new ObjectId(id));

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
      this.emitMessagesRead(messages, userId, messageIds);

      return ResponseHelper.success({ success: true });
    } catch (err) {
      console.error("❌ Error in markAsRead:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteMessage(userId: string, messageId: string): Promise<Response> {
    try {
      const message = await this.messageRepo.getMessageById(
        new ObjectId(messageId),
      );

      if (!message) {
        return ResponseHelper.error("Message introuvable", 404);
      }

      if (message.sender.toString() !== userId) {
        return ResponseHelper.error(
          "Vous n'êtes pas l'expéditeur de ce message",
          403,
        );
      }

      if (message.type !== MessageType.TEXT && "url" in message.payload) {
        await this.deleteMessageFile(message);
      }

      const deleted = await this.messageRepo.deleteMessage(
        new ObjectId(messageId),
        new ObjectId(userId),
      );

      if (!deleted) {
        return ResponseHelper.error("Échec de la suppression", 500);
      }

      if (this.transactionService) {
        try {
          await this.userRepo.removeCoins(
            new ObjectId(userId),
            COINS_CONFIG.DELETE_MESSAGE,
          );
          await this.transactionService.addStandardSpending(
            new ObjectId(userId),
            "message",
            new ObjectId(messageId),
            "Suppression d'un message",
            COINS_CONFIG.DELETE_MESSAGE,
          );
        } catch (err) {
          console.error("Erreur lors du retrait des coins:", err);
        }
      }

      this.emitMessageDeleted(message, userId);

      return ResponseHelper.success({ message: "Message supprimé" });
    } catch (err) {
      console.error("❌ Error in deleteMessage:", err);
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

      if (message.sender.toString() !== userId) {
        return ResponseHelper.error(
          "Vous n'êtes pas l'auteur de ce message",
          403,
        );
      }

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

      this.emitMessageUpdated(updatedMessage, response);

      return ResponseHelper.success(response);
    } catch (err) {
      console.error("❌ Error in updateMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Response> {
    try {
      const messages = await this.messageRepo.getConversation(
        new ObjectId(userId),
        new ObjectId(otherUserId),
        new ObjectId(userId),
      );

      for (const message of messages) {
        if (message.type !== MessageType.TEXT && "url" in message.payload) {
          await this.deleteMessageFile(message);
        }
      }

      const count = await this.messageRepo.deleteConversation(
        new ObjectId(userId),
        new ObjectId(otherUserId),
      );

      this.emitConversationDeleted(userId, otherUserId, count);

      return ResponseHelper.success({ deletedCount: count });
    } catch (err) {
      console.error("❌ Error in deleteConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getRecentChats(userId: string): Promise<Response> {
    try {
      const currentUserId = new ObjectId(userId);
      const messages = await this.messageRepo.getRecentChats(currentUserId);

      if (!messages.length) {
        this.emitRecentChatsEmpty(userId);
        return ResponseHelper.success([]);
      }

      const result: Array<{
        user: {
          _id: string;
          firstName: string;
          lastName: string;
          userName: string;
          image?: string;
        };
        lastMessage: MessageResponse;
        unreadCount: number;
      }> = [];

      for (const msg of messages) {
        const otherUserIdObj =
          msg.sender.toString() === userId ? msg.receiver : msg.sender;
        // ✅ Supprimé - const otherUserId = otherUserIdObj.toString(); (inutilisé)

        const otherUser = await this.userRepo.findById(otherUserIdObj);
        if (!otherUser) continue;

        const unreadCount = await this.messageRepo.countUnreadMessages(
          currentUserId,
          otherUserIdObj, // ✅ Utilisation directe de l'objet ObjectId
        );

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

      result.sort(
        (a, b) =>
          b.lastMessage.createdAt!.getTime() -
          a.lastMessage.createdAt!.getTime(),
      );

      this.emitRecentChatsUpdated(userId, result);

      return ResponseHelper.success(result);
    } catch (err) {
      console.error("❌ Error in getRecentChats:", err);
      this.emitRecentChatsError(userId);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteAllMessagesByUser(userId: string): Promise<Response> {
    try {
      const messages = await this.messageRepo.getRecentChats(
        new ObjectId(userId),
      );

      for (const msg of messages) {
        if (msg.type !== MessageType.TEXT && "url" in msg.payload) {
          await this.deleteMessageFile(msg);
        }
      }

      const count = await this.messageRepo.deleteAllMessagesByUser(
        new ObjectId(userId),
      );

      this.emitAllMessagesDeleted(userId, count);

      return ResponseHelper.success({ deletedCount: count });
    } catch (err) {
      console.error("❌ Error in deleteAllMessagesByUser:", err);
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

      this.emitConversationSoftDeleted(userId, otherUserId, count);

      return ResponseHelper.success({
        message: `${count} messages masqués pour vous`,
        modifiedCount: count,
      });
    } catch (err) {
      console.error("❌ Error in softDeleteConversationForUser:", err);
      return ResponseHelper.serverError(String(err));
    }
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

      this.emitMessageSoftDeleted(userId, messageId);

      return ResponseHelper.success({ message: "Message masqué pour vous" });
    } catch (err) {
      console.error("❌ Error in softDeleteMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // ------------------------- Méthodes privées pour Socket.IO -------------------------

  private emitNewMessage(
    senderId: string,
    receiverId: string,
    response: MessageResponse,
  ): void {
    try {
      const io = getIo();
      console.log(
        `📤 Émission new_message vers user:${senderId} et user:${receiverId}`,
      );
      io.to(`user:${senderId}`).emit("new_message", response);
      io.to(`user:${receiverId}`).emit("new_message", response);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitConversationViewed(userId: string, otherUserId: string): void {
    try {
      const io = getIo();
      const event: ConversationViewedEvent = {
        userId,
        otherUserId,
        viewedAt: new Date(),
      };
      console.log(
        `📤 Émission conversation_viewed entre ${userId} et ${otherUserId}`,
      );
      io.to(`user:${otherUserId}`).emit("conversation_viewed", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitMessagesRead(
    messages: Message[],
    userId: string,
    messageIds: string[],
  ): void {
    try {
      const io = getIo();
      const event: MessagesReadEvent = {
        messageIds,
        readerId: userId,
      };
      for (const message of messages) {
        io.to(`user:${message.sender.toString()}`).emit("messages_read", event);
      }
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitMessageDeleted(message: Message, userId: string): void {
    try {
      const io = getIo();
      const event: MessageDeletedEvent = {
        messageId: message._id!.toString(),
        deletedBy: userId,
      };
      console.log(`📤 Émission message_deleted pour le message ${message._id}`);
      io.to(`user:${message.sender.toString()}`).emit("message_deleted", event);
      io.to(`user:${message.receiver.toString()}`).emit(
        "message_deleted",
        event,
      );
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitMessageUpdated(
    message: Message,
    response: MessageResponse,
  ): void {
    try {
      const io = getIo();
      console.log(`📤 Émission message_updated pour le message ${message._id}`);
      io.to(`user:${message.sender.toString()}`).emit(
        "message_updated",
        response,
      );
      io.to(`user:${message.receiver.toString()}`).emit(
        "message_updated",
        response,
      );
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitConversationDeleted(
    userId: string,
    otherUserId: string,
    count: number,
  ): void {
    try {
      const io = getIo();
      const event: ConversationDeletedEvent = {
        otherUserId,
        deletedCount: count,
      };
      console.log(
        `📤 Émission conversation_deleted entre ${userId} et ${otherUserId}`,
      );
      io.to(`user:${userId}`).emit("conversation_deleted", event);
      io.to(`user:${otherUserId}`).emit("conversation_deleted", {
        otherUserId: userId,
        deletedCount: count,
      });
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitRecentChatsEmpty(userId: string): void {
    try {
      const io = getIo();
      const event: RecentChatsEmptyEvent = {
        userId,
        timestamp: new Date(),
      };
      console.log(
        `📤 Émission recent_chats_empty pour l'utilisateur ${userId}`,
      );
      io.to(`user:${userId}`).emit("recent_chats_empty", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitRecentChatsUpdated(
    userId: string,
    chats: Array<{
      user: {
        _id: string;
        firstName: string;
        lastName: string;
        userName: string;
        image?: string;
      };
      lastMessage: MessageResponse;
      unreadCount: number;
    }>,
  ): void {
    try {
      const io = getIo();
      const event: RecentChatsUpdatedEvent = {
        userId,
        chats,
        timestamp: new Date(),
        totalUnread: chats.reduce((acc, chat) => acc + chat.unreadCount, 0),
      };
      console.log(
        `📤 Émission recent_chats_updated pour l'utilisateur ${userId}`,
      );
      io.to(`user:${userId}`).emit("recent_chats_updated", event);

      for (const chat of chats) {
        const previewEvent: ChatPreviewUpdatedEvent = {
          otherUserId: chat.user._id,
          lastMessage: chat.lastMessage,
          unreadCount: chat.unreadCount,
          timestamp: new Date(),
        };
        io.to(`user:${userId}`).emit("chat_preview_updated", previewEvent);
      }
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitRecentChatsError(userId: string): void {
    try {
      const io = getIo();
      const event: RecentChatsErrorEvent = {
        userId,
        error: "Erreur lors de la récupération des conversations",
        timestamp: new Date(),
      };
      io.to(`user:${userId}`).emit("recent_chats_error", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitAllMessagesDeleted(userId: string, count: number): void {
    try {
      const io = getIo();
      const event: AllMessagesDeletedEvent = {
        userId,
        deletedCount: count,
        timestamp: new Date(),
      };
      console.log(
        `📤 Émission all_messages_deleted pour l'utilisateur ${userId}`,
      );
      io.to(`user:${userId}`).emit("all_messages_deleted", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitConversationSoftDeleted(
    userId: string,
    otherUserId: string,
    count: number,
  ): void {
    try {
      const io = getIo();
      const event: ConversationSoftDeletedEvent = {
        otherUserId,
        modifiedCount: count,
      };
      console.log(`📤 Émission conversation_soft_deleted pour ${userId}`);
      io.to(`user:${userId}`).emit("conversation_soft_deleted", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  private emitMessageSoftDeleted(userId: string, messageId: string): void {
    try {
      const io = getIo();
      const event: MessageSoftDeletedEvent = {
        messageId,
        userId,
      };
      console.log(`📤 Émission message_soft_deleted pour ${messageId}`);
      io.to(`user:${userId}`).emit("message_soft_deleted", event);
    } catch (socketError) {
      console.error("⚠️ Erreur Socket.IO:", socketError);
    }
  }

  // ------------------------- Méthodes privées utilitaires -------------------------

  private getStorePath(messageType: MessageType, userId: string): string {
    const basePath = UPLOAD_PATHS.images.replace("./", "");
    return `${basePath}-${userId}/${UPLOAD_PATHS.messages}`;
  }

  private getAllowedMimeTypes(messageType: MessageType): string[] {
    switch (messageType) {
      case MessageType.IMAGE:
        return ["image/jpeg", "image/png", "image/gif", "image/webp"];
      case MessageType.VIDEO:
        return ["video/mp4", "video/webm", "video/ogg"];
      case MessageType.DOCUMENT:
        return [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
          "text/csv",
          "application/rtf",
          "application/json",
          "application/xml",
        ];
      default:
        return [];
    }
  }
  private getMaxSize(messageType: MessageType): number {
    switch (messageType) {
      case MessageType.IMAGE:
        return 10 * 1024 * 1024; // 10 MB
      case MessageType.VIDEO:
        return 100 * 1024 * 1024; // 100 MB
      case MessageType.DOCUMENT:
        return 20 * 1024 * 1024; // 20 MB
      default:
        return 5 * 1024 * 1024; // 5 MB
    }
  }

  private getCoinsForMessageType(messageType: MessageType): number {
    switch (messageType) {
      case MessageType.TEXT:
        return COINS_CONFIG.SEND_MESSAGE;
      case MessageType.IMAGE:
        return COINS_CONFIG.SEND_IMAGE;
      case MessageType.VIDEO:
        return COINS_CONFIG.SEND_VIDEO;
      case MessageType.DOCUMENT:
        return COINS_CONFIG.SEND_DOCUMENT;
      default:
        return COINS_CONFIG.SEND_MESSAGE;
    }
  }

  private getMimeTypeFromFileName(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".rtf": "application/rtf",
      ".json": "application/json",
      ".xml": "application/xml",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  private extractFileName(filePath: string): string {
    return path.basename(filePath);
  }

  private extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return path.basename(urlObj.pathname);
    } catch {
      return path.basename(url);
    }
  }

  private async deleteMessageFile(message: Message): Promise<void> {
    try {
      if (message.type !== MessageType.TEXT && "url" in message.payload) {
        const url = message.payload.url as string;
        const fileName = this.extractFileNameFromUrl(url);

        const basePath = UPLOAD_PATHS.images.replace("./", "");
        const filePath = path.join(
          process.cwd(),
          basePath,
          `${basePath}-${message.sender.toString()}`,
          UPLOAD_PATHS.messages,
          fileName,
        );

        await FileService.deleteFile(filePath);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du fichier:", error);
    }
  }

  private validatePayload(
    type: MessageType,
    payload: TextPayload | MediaPayload,
  ): string | null {
    switch (type) {
      case MessageType.TEXT:
        if (
          !("text" in payload) ||
          typeof payload.text !== "string" ||
          payload.text.trim() === ""
        ) {
          return "Le texte du message est invalide ou vide";
        }
        break;

      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.DOCUMENT:
        if (
          !("url" in payload) ||
          typeof payload.url !== "string" ||
          payload.url.trim() === ""
        ) {
          return "URL requise pour les médias";
        }
        if (!("mimeType" in payload) || typeof payload.mimeType !== "string") {
          return "Type MIME requis";
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
}
