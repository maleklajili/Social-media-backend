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
  SendGroupMessageInput,
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
import { FriendGroupRepository } from "../../repositories/friend-group-repository";

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
interface SearchResultConversation {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    image?: string;
  };
  messages: MessageResponse[];
  nameMatch: boolean;
  lastMessage: MessageResponse;
  messageCount: number;
}
interface SearchResultsEvent {
  query: string;
  results: SearchResultConversation[];
  timestamp: Date;
  totalResults: number;
}

export class MessageService
  extends BaseService<Message>
  implements IMessageService
{
  private friendGroupRepo: FriendGroupRepository;

  constructor(
    private messageRepo: MessageRepository,
    private userRepo: userRepository,
    private transactionService?: TransactionService,
  ) {
    super(CollectionsManager.messageCollection);
    this.friendGroupRepo = new FriendGroupRepository();
  }
  // MessageService.ts (backend)

  async leaveGroup(userId: string, groupId: string): Promise<Response> {
    try {
      const userObjectId = new ObjectId(userId);
      const groupObjectId = new ObjectId(groupId);

      // 1. Récupérer le groupe
      const group =
        await this.friendGroupRepo.getFriendGroupById(groupObjectId);
      if (!group) {
        return ResponseHelper.notFound("Groupe introuvable");
      }

      // 2. Vérifier que l'utilisateur est membre
      const isMember = group.members.some((m) => m.equals(userObjectId));
      if (!isMember) {
        return ResponseHelper.forbidden("Vous n'êtes pas membre de ce groupe");
      }

      // 3. Gestion du propriétaire
      if (group.userId.equals(userObjectId)) {
        const remainingMembers = group.members.filter(
          (m) => !m.equals(userObjectId),
        );
        if (remainingMembers.length === 0) {
          // Dernier membre : supprimer le groupe
          await this.friendGroupRepo.deleteFriendGroup(groupObjectId);
          await this.messageRepo.deleteAllGroupMessages(groupObjectId);
          const io = getIo();
          io.emit("group_deleted", { groupId: groupObjectId.toString() });
          return ResponseHelper.success({
            message: "Groupe supprimé car vous étiez le seul membre",
          });
        } else {
          return ResponseHelper.forbidden(
            "Vous êtes le propriétaire. Transférez d'abord la propriété à un autre membre ou supprimez le groupe.",
          );
        }
      }

      // 4. Récupérer le nom de l'utilisateur qui quitte
      const leavingUser = await this.userRepo.findById(userObjectId);
      if (!leavingUser) {
        return ResponseHelper.error("Utilisateur introuvable", 404);
      }
      const userName =
        `${leavingUser.firstName} ${leavingUser.lastName}`.trim() ||
        leavingUser.userName;

      // 5. Créer un message système persistant
      const systemMessage: Message = {
        _id: new ObjectId(),
        groupId: groupObjectId,
        type: MessageType.SYSTEM,
        payload: { text: `${userName} a quitté le groupe` },
        sender: userObjectId,
        read: false,
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.messageRepo.sendMessage(systemMessage);

      // 6. Soft delete la conversation pour l'utilisateur qui quitte
      await this.messageRepo.softDeleteGroupConversationForUser(
        groupObjectId,
        userObjectId,
      );

      // 7. Retirer l'utilisateur du groupe
      const removed = await this.friendGroupRepo.removeMemberFromGroup(
        groupObjectId,
        userObjectId,
      );
      if (!removed) {
        return ResponseHelper.error("Échec du retrait du groupe", 500);
      }

      // 8. Émettre le message système à tous les membres restants (temps réel)
      const io = getIo();
      const remainingMemberIds = [...group.members, group.userId]
        .filter((id) => !id.equals(userObjectId))
        .map((id) => id.toString());

      // Vérification que l'ID du message système existe
      if (!systemMessage._id) {
        return ResponseHelper.error(
          "Erreur lors de la création du message système",
          500,
        );
      }

      const systemMessageResponse = {
        _id: systemMessage._id.toString(),
        sender: {
          _id: leavingUser._id!.toString(),
          firstName: leavingUser.firstName,
          lastName: leavingUser.lastName,
          userName: leavingUser.userName,
          image: leavingUser.image,
        },
        groupId: groupObjectId.toString(),
        type: MessageType.SYSTEM,
        payload: systemMessage.payload,
        read: false,
        readBy: [],
        createdAt: systemMessage.createdAt,
        updatedAt: systemMessage.updatedAt,
      };

      for (const memberId of remainingMemberIds) {
        io.to(`user:${memberId}`).emit("group_message", systemMessageResponse);
        io.to(`user:${memberId}`).emit("group_member_left", {
          groupId: groupObjectId.toString(),
          userId: userId,
          leftAt: new Date(),
        });
      }

      return ResponseHelper.success({ message: "Vous avez quitté le groupe" });
    } catch (err) {
      console.error(" Error in leaveGroup:", err);
      return ResponseHelper.serverError(String(err));
    }
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
      const sender = await this.userRepo.findById(new ObjectId(senderId));
      const receiver = await this.userRepo.findById(new ObjectId(receiverId));

      if (!sender || !receiver) {
        return ResponseHelper.error(
          "Expéditeur ou destinataire introuvable",
          404,
        );
      }

      const mediaType = formData.get("type") as string | null;

      if (!mediaType) {
        return ResponseHelper.error("Type de média invalide ou manquant", 400);
      }

      if (!Object.values(MessageType).includes(mediaType as MessageType)) {
        return ResponseHelper.error("Type de média invalide ou manquant", 400);
      }

      const typedMediaType = mediaType as MessageType;

      const basePath = UPLOAD_PATHS.images.replace("./", "");
      const storePath = `${basePath}-${senderId}/${UPLOAD_PATHS.messages}`;

      const uploadResult = (await handleFileUpload(formData, {
        fieldName: "file",
        storePath,
        fileName: `message-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId: new ObjectId(senderId),
      })) as UploadResult;

      if (!uploadResult || !uploadResult.fileName) {
        return ResponseHelper.error("Erreur lors de l'upload du fichier", 500);
      }

      const mimeTypeFromExt = this.getMimeTypeFromFileName(
        uploadResult.fileName,
      );

      const allowedTypes = this.getAllowedMimeTypes(typedMediaType);
      if (!allowedTypes.includes(mimeTypeFromExt)) {
        return ResponseHelper.error(
          `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(", ")}`,
          400,
        );
      }

      const maxSize = this.getMaxSize(typedMediaType);
      if (uploadResult.size && uploadResult.size > maxSize) {
        const sizeMB = (uploadResult.size / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        return ResponseHelper.error(
          `Fichier trop volumineux (${sizeMB} MB). Taille max: ${maxSizeMB} MB`,
          400,
        );
      }

      const baseUrl =
        process.env.BASE_URL || `http://localhost:${process.env.PORT || 9000}`;
      const cleanPath = storePath.replace(/^\.\//, "");
      const fileUrl = `${baseUrl}/${cleanPath}/${uploadResult.fileName}`;

      const payload: MediaPayload = {
        url: fileUrl,
        mimeType: mimeTypeFromExt,
        size: uploadResult.size,
        fileName: this.extractFileName(uploadResult.fileName),
      };

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

      await this.messageRepo.sendMessage(message);

      if (this.transactionService) {
        try {
          const coinsAmount = this.getCoinsForMessageType(typedMediaType);
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
        } catch (err) {
          console.error("❌ Erreur lors de l'ajout de coins:", err);
        }
      }

      const response = this.formatMessageResponse(message, sender, receiver);

      this.emitNewMessage(senderId, receiverId, response);

      return ResponseHelper.success(response);
    } catch (err) {
      console.error("❌❌❌ ERREUR dans sendMediaMessage:", err);
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

      const unreadMessageIds = messages
        .filter((msg) => !msg.read && msg.receiver?.toString() === userId)
        .map((msg) => msg._id!.toString());

      if (unreadMessageIds.length > 0) {
        setImmediate(() => {
          this.markAsRead(userId, unreadMessageIds).catch((err) =>
            console.error("Erreur marquage lecture:", err),
          );
        });
      }

      if (!messages.length) {
        return ResponseHelper.success([]);
      }

      const userIds = new Set<string>();
      messages.forEach((m) => {
        userIds.add(m.sender.toString());
        if (m.receiver) userIds.add(m.receiver.toString());
      });

      const users = await this.userRepo.findByIds(
        Array.from(userIds).map((id) => new ObjectId(id)),
      );

      const userMap = new Map<string, User>(
        users.map((u: User) => [u._id!.toString(), u]),
      );

      const formattedMessages = messages.map((msg) => {
        const sender = userMap.get(msg.sender.toString());
        const receiver = msg.receiver
          ? userMap.get(msg.receiver.toString())
          : undefined;
        if (!sender)
          throw new Error("Utilisateur introuvable lors du formatage");
        return this.formatMessageResponse(msg, sender, receiver!);
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
        (msg) => msg.receiver?.toString() !== userId,
      );
      if (unauthorized) {
        return ResponseHelper.error(
          "Vous ne pouvez marquer comme lus que vos propres messages reçus",
          403,
        );
      }

      await this.messageRepo.markAsRead(objectIds);

      const io = getIo();
      const event: MessagesReadEvent = {
        messageIds,
        readerId: userId,
      };

      const uniqueSenders = new Set<string>();
      for (const message of messages) {
        const senderId = message.sender.toString();
        if (!uniqueSenders.has(senderId)) {
          uniqueSenders.add(senderId);
          io.to(`user:${senderId}`).emit("messages_read", event);
        }
      }

      io.to(`user:${userId}`).emit("messages_read", event);

      return ResponseHelper.success({
        success: true,
        modifiedCount: messageIds.length,
      });
    } catch (err) {
      console.error("❌ Error in markAsRead:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  // Dans message-service.ts, ajoutez ces méthodes :

  async deleteGroupMessage(
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

      // Vérifier que l'utilisateur est l'expéditeur du message
      if (message.sender.toString() !== userId) {
        return ResponseHelper.error(
          "Vous n'êtes pas l'expéditeur de ce message",
          403,
        );
      }

      // Vérifier que c'est bien un message de groupe
      if (!message.groupId) {
        return ResponseHelper.error("Ce n'est pas un message de groupe", 400);
      }

      // Supprimer le fichier si nécessaire
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

      // Émettre l'événement à tous les membres du groupe
      const io = getIo();
      const group = await this.friendGroupRepo.getFriendGroupById(
        message.groupId,
      );
      if (group) {
        const memberIds = [...group.members, group.userId].map((id) =>
          id.toString(),
        );
        for (const memberId of memberIds) {
          io.to(`user:${memberId}`).emit("group_message_deleted", {
            messageId: messageId,
            deletedBy: userId,
            groupId: message.groupId.toString(),
          });
        }
      }

      return ResponseHelper.success({ message: "Message supprimé du groupe" });
    } catch (err) {
      console.error("❌ Error in deleteGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateGroupMessage(
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

      if (!message.groupId) {
        return ResponseHelper.error("Ce n'est pas un message de groupe", 400);
      }

      // Vérifier que c'est un message texte
      if (message.type !== MessageType.TEXT) {
        return ResponseHelper.error(
          "Seuls les messages texte peuvent être modifiés",
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
      if (!sender) {
        return ResponseHelper.error("Utilisateur introuvable", 404);
      }

      const response = {
        _id: updatedMessage._id!.toString(),
        sender: {
          _id: sender._id!.toString(),
          firstName: sender.firstName,
          lastName: sender.lastName,
          userName: sender.userName,
          image: sender.image,
        },
        groupId: updatedMessage.groupId!.toString(),
        type: updatedMessage.type,
        payload: updatedMessage.payload,
        read: updatedMessage.read,
        readBy: updatedMessage.readBy?.map((id) => id.toString()) || [],
        createdAt: updatedMessage.createdAt,
        updatedAt: updatedMessage.updatedAt,
      };

      // Émettre à tous les membres du groupe
      const io = getIo();
      const group = await this.friendGroupRepo.getFriendGroupById(
        updatedMessage.groupId!,
      );
      if (group) {
        const memberIds = [...group.members, group.userId].map((id) =>
          id.toString(),
        );
        for (const memberId of memberIds) {
          io.to(`user:${memberId}`).emit("group_message_updated", response);
        }
      }

      return ResponseHelper.success(response);
    } catch (err) {
      console.error("❌ Error in updateGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async softDeleteGroupMessage(
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

      if (!message.groupId) {
        return ResponseHelper.error("Ce n'est pas un message de groupe", 400);
      }

      // Vérifier que l'utilisateur est membre du groupe
      const group = await this.friendGroupRepo.getFriendGroupById(
        message.groupId,
      );
      if (!group) {
        return ResponseHelper.error("Groupe introuvable", 404);
      }

      const isMember =
        group.members.some((m) => m.toString() === userId) ||
        group.userId.toString() === userId;
      if (!isMember) {
        return ResponseHelper.error("Vous n'êtes pas membre de ce groupe", 403);
      }

      const updated = await this.messageRepo.softDeleteMessage(
        new ObjectId(messageId),
        new ObjectId(userId),
      );

      if (!updated) {
        return ResponseHelper.error("Message déjà masqué ou introuvable", 400);
      }

      // Émettre l'événement à l'utilisateur uniquement (soft delete est personnel)
      const io = getIo();
      io.to(`user:${userId}`).emit("group_message_soft_deleted", {
        messageId: messageId,
        userId: userId,
        groupId: message.groupId.toString(),
      });

      return ResponseHelper.success({ message: "Message masqué pour vous" });
    } catch (err) {
      console.error("❌ Error in softDeleteGroupMessage:", err);
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
      const receiver = updatedMessage.receiver
        ? await this.userRepo.findById(updatedMessage.receiver)
        : null;
      if (!sender || (updatedMessage.receiver && !receiver)) {
        return ResponseHelper.error("Utilisateur introuvable", 404);
      }

      const response = this.formatMessageResponse(
        updatedMessage,
        sender,
        receiver!,
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
      console.error(" Error in deleteConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async sendMediaGroupMessage(
    senderId: string,
    groupId: string,
    formData: FormData,
    mediaType: MessageType,
  ): Promise<Response> {
    try {
      const sender = await this.userRepo.findById(new ObjectId(senderId));
      if (!sender) return ResponseHelper.error("Expéditeur introuvable", 404);

      const group = await this.friendGroupRepo.getFriendGroupById(
        new ObjectId(groupId),
      );
      if (!group) return ResponseHelper.notFound("Groupe introuvable");

      const isMember =
        group.members.some((m) => m.toString() === senderId) ||
        group.userId.toString() === senderId;
      if (!isMember)
        return ResponseHelper.forbidden("Vous n'êtes pas membre du groupe");

      // Upload du fichier (réutilise ta logique existante)
      const basePath = UPLOAD_PATHS.images.replace("./", "");
      const storePath = `${basePath}-${senderId}/${UPLOAD_PATHS.messages}`;

      const uploadResult = (await handleFileUpload(formData, {
        fieldName: "file",
        storePath,
        fileName: `group-${groupId}-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId: new ObjectId(senderId),
      })) as UploadResult;

      if (!uploadResult?.fileName) {
        return ResponseHelper.error("Erreur lors de l'upload", 500);
      }

      const mimeType = this.getMimeTypeFromFileName(uploadResult.fileName);
      const allowed = this.getAllowedMimeTypes(mediaType);
      if (!allowed.includes(mimeType)) {
        return ResponseHelper.error(
          `Type de fichier non autorisé pour ${mediaType}`,
          400,
        );
      }

      const baseUrl =
        process.env.BASE_URL || `http://localhost:${process.env.PORT || 9000}`;
      const cleanPath = storePath.replace(/^\.\//, "");
      const fileUrl = `${baseUrl}/${cleanPath}/${uploadResult.fileName}`;

      const payload: MediaPayload = {
        url: fileUrl,
        mimeType,
        size: uploadResult.size,
        fileName: this.extractFileName(uploadResult.fileName),
      };

      const message: Message = {
        _id: new ObjectId(),
        sender: new ObjectId(senderId),
        groupId: new ObjectId(groupId),
        type: mediaType,
        payload,
        read: false,
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.messageRepo.sendMessage(message);

      const response = {
        _id: message._id!.toString(),
        sender: {
          _id: sender._id!.toString(),
          firstName: sender.firstName,
          lastName: sender.lastName,
          userName: sender.userName,
          image: sender.image,
        },
        groupId,
        type: message.type,
        payload: message.payload,
        read: false,
        readBy: [senderId],
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      // Émettre à tous les membres
      const io = getIo();
      const memberIds = [...group.members, group.userId].map((id) =>
        id.toString(),
      );
      for (const memberId of memberIds) {
        io.to(`user:${memberId}`).emit("group_message", response);
      }

      if (this.transactionService) {
        const coins = this.getCoinsForMessageType(mediaType);
        await this.userRepo.addCoins(new ObjectId(senderId), coins);
        await this.transactionService.addStandardEarning(
          new ObjectId(senderId),
          coins,
          "group_message",
          message._id!,
          `Envoi d'un ${mediaType} dans un groupe`,
          { groupId },
        );
      }

      return ResponseHelper.success(response, 201);
    } catch (err) {
      console.error(" sendMediaGroupMessage error:", err);
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
        // Ignorer les messages de groupe (ils n'ont pas de receiver)
        if (!msg.receiver) continue;

        const otherUserIdObj =
          msg.sender.toString() === userId ? msg.receiver : msg.sender;

        const otherUser = await this.userRepo.findById(otherUserIdObj);
        if (!otherUser) continue;

        const unreadCount = await this.messageRepo.countUnreadMessages(
          currentUserId,
          otherUserIdObj,
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
  async getGroupConversationsList(userId: string): Promise<Response> {
    try {
      const userObjectId = new ObjectId(userId);
      const groups = await this.friendGroupRepo.getUserGroups(userObjectId);
      const result = [];

      for (const group of groups) {
        const unreadCount = await this.messageRepo.countUnreadGroupMessages(
          group._id!,
          userObjectId,
        );

        // Récupérer le dernier message du groupe
        const lastMessage = await this.messageRepo.getLastGroupMessage(
          group._id!,
          userObjectId,
        );
        let lastMessageData = null;
        if (lastMessage) {
          const sender = await this.userRepo.findById(lastMessage.sender);
          let content = "";
          if (lastMessage.type === MessageType.TEXT) {
            content = (lastMessage.payload as TextPayload).text;
          } else if (lastMessage.type === MessageType.IMAGE)
            content = "📷 Image";
          else if (lastMessage.type === MessageType.VIDEO) content = "🎥 Vidéo";
          else content = "📎 Document";
          if (content.length > 30) content = content.substring(0, 30) + "…";

          lastMessageData = {
            content,
            time: lastMessage.createdAt,
            senderName: sender
              ? `${sender.firstName} ${sender.lastName}`
              : "Ancien membre",
            senderId: sender?._id?.toString(),
            senderIsUser: sender?._id?.toString() === userId,
          };
        }

        result.push({
          id: group._id!.toString(),
          name: group.name,
          icon: group.icon,
          color: group.color,
          unreadCount,
          lastMessage: lastMessageData,
          membersCount: group.members.length + (group.userId ? 1 : 0),
          ownerId: group.userId.toString(),
        });
      }

      return ResponseHelper.success(result);
    } catch (err) {
      console.error("❌ getGroupConversationsList error:", err);
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
        message.receiver?.toString() !== userId
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

  async searchMessages(userId: string, query: string): Promise<Response> {
    try {
      if (!query || query.trim() === "") {
        return ResponseHelper.error("La requête de recherche est vide", 400);
      }

      const currentUserId = new ObjectId(userId);

      const messages = await this.messageRepo.searchMessages(
        currentUserId,
        query,
      );

      if (!messages.length) {
        return ResponseHelper.success([]);
      }

      const userIds = new Set<string>();
      messages.forEach((msg) => {
        userIds.add(msg.sender.toString());
        if (msg.receiver) userIds.add(msg.receiver.toString());
      });

      const users = await this.userRepo.findByIds(
        Array.from(userIds).map((id) => new ObjectId(id)),
      );

      const userMap = new Map<string, User>(
        users.map((u: User) => [u._id!.toString(), u]),
      );

      const formattedMessages = messages.map((msg) => {
        const sender = userMap.get(msg.sender.toString());
        const receiver = msg.receiver
          ? userMap.get(msg.receiver.toString())
          : undefined;
        if (!sender)
          throw new Error("Utilisateur introuvable lors du formatage");
        return this.formatMessageResponse(msg, sender, receiver!);
      });

      const conversations = new Map<string, SearchResultConversation>();

      for (const msg of formattedMessages) {
        const otherUserId =
          msg.sender._id === userId ? msg.receiver!._id : msg.sender._id;
        const otherUser =
          msg.sender._id === userId ? msg.receiver! : msg.sender;

        if (!conversations.has(otherUserId)) {
          const fullName =
            `${otherUser.firstName} ${otherUser.lastName}`.toLowerCase();
          const searchQuery = query.toLowerCase();

          const nameMatches =
            fullName.includes(searchQuery) ||
            otherUser.firstName.toLowerCase().includes(searchQuery) ||
            otherUser.lastName.toLowerCase().includes(searchQuery);

          conversations.set(otherUserId, {
            user: otherUser,
            messages: [],
            nameMatch: nameMatches,
            lastMessage: msg,
            messageCount: 0,
          });
        }

        const conversation = conversations.get(otherUserId)!;
        conversation.messages.push(msg);
        conversation.messageCount = conversation.messages.length;
        conversation.lastMessage = msg;
      }

      const result = Array.from(conversations.values()).sort(
        (a, b) =>
          b.lastMessage.createdAt!.getTime() -
          a.lastMessage.createdAt!.getTime(),
      );

      this.emitSearchResults(userId, result, query);

      return ResponseHelper.success({
        query,
        results: result,
        totalResults: result.length,
      });
    } catch (err) {
      console.error("❌ Error in searchMessages:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async sendGroupMessage(
    senderId: string,
    input: SendGroupMessageInput,
  ): Promise<Response> {
    try {
      const sender = await this.userRepo.findById(new ObjectId(senderId));
      if (!sender) {
        return ResponseHelper.error("Expéditeur introuvable", 404);
      }

      const groupId = new ObjectId(input.groupId);
      const group = await this.friendGroupRepo.getFriendGroupById(groupId);
      if (!group) {
        return ResponseHelper.notFound("Groupe introuvable");
      }

      // Vérifier que l'utilisateur est membre du groupe
      const isMember =
        group.members.some((m) => m.toString() === senderId) ||
        group.userId.toString() === senderId;
      if (!isMember) {
        return ResponseHelper.forbidden("Vous n'êtes pas membre de ce groupe");
      }

      if (!input.text || input.text.trim() === "") {
        return ResponseHelper.error("Le message ne peut pas être vide", 400);
      }

      const message: Message = {
        _id: new ObjectId(),
        sender: new ObjectId(senderId),
        groupId: groupId,
        type: MessageType.TEXT,
        payload: { text: input.text.trim() },
        read: false,
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.messageRepo.sendMessage(message);

      // Formatage de la réponse
      const response = {
        _id: message._id!.toString(),
        sender: {
          _id: sender._id!.toString(),
          firstName: sender.firstName,
          lastName: sender.lastName,
          userName: sender.userName,
          image: sender.image,
        },
        groupId: groupId.toString(),
        type: message.type,
        payload: message.payload,
        read: false,
        readBy: [senderId],
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      // Émettre le message à tous les membres du groupe via Socket.IO
      const io = getIo();
      const memberIds = [...group.members, group.userId].map((id) =>
        id.toString(),
      );
      for (const memberId of memberIds) {
        io.to(`user:${memberId}`).emit("group_message", response);
      }

      // Ajout des coins si transaction service présent
      if (this.transactionService) {
        try {
          await this.userRepo.addCoins(
            new ObjectId(senderId),
            COINS_CONFIG.SEND_MESSAGE,
          );
          await this.transactionService.addStandardEarning(
            new ObjectId(senderId),
            COINS_CONFIG.SEND_MESSAGE,
            "group_message",
            message._id!,
            "Envoi d'un message dans un groupe",
            { groupId: groupId.toString() },
          );
        } catch (err) {
          console.error("Erreur lors de l'ajout de coins:", err);
        }
      }

      return ResponseHelper.success(response, 201);
    } catch (err) {
      console.error("❌ Error in sendGroupMessage:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getGroupConversation(
    userId: string,
    groupId: string,
  ): Promise<Response> {
    try {
      const group = await this.friendGroupRepo.getFriendGroupById(
        new ObjectId(groupId),
      );
      if (!group) return ResponseHelper.notFound("Groupe introuvable");

      const isMember =
        group.members.some((m) => m.toString() === userId) ||
        group.userId.toString() === userId;
      if (!isMember)
        return ResponseHelper.forbidden("Vous n'êtes pas membre de ce groupe");

      const messages = await this.messageRepo.getGroupConversation(
        new ObjectId(groupId),
        new ObjectId(userId),
      );

      // Identifier les messages non lus (ceux que l'utilisateur n'a pas encore lus)
      const unreadMessageIds = messages
        .filter((msg) => !msg.read && msg.sender.toString() !== userId)
        .map((msg) => msg._id!);

      if (unreadMessageIds.length > 0) {
        // Marquer comme lus dans la base de données
        await this.messageRepo.markGroupMessagesAsRead(
          new ObjectId(groupId),
          new ObjectId(userId),
        );

        // Émettre un événement socket pour informer tous les membres du groupe
        const io = getIo();
        const event = {
          messageIds: unreadMessageIds.map((id) => id.toString()),
          readerId: userId,
          groupId: groupId,
        };
        const memberIds = [...group.members, group.userId].map((id) =>
          id.toString(),
        );
        for (const memberId of memberIds) {
          io.to(`user:${memberId}`).emit("group_messages_read", event);
        }
      }

      // Récupérer les informations des expéditeurs pour la réponse
      const senderIds = [...new Set(messages.map((m) => m.sender.toString()))];
      const users = await this.userRepo.findByIds(
        senderIds.map((id) => new ObjectId(id)),
      );
      const userMap = new Map(users.map((u) => [u._id!.toString(), u]));

      const formattedMessages = messages.map((msg) => {
        const sender = userMap.get(msg.sender.toString());
        if (!sender) throw new Error("Expéditeur introuvable");
        return {
          _id: msg._id!.toString(),
          sender: {
            _id: sender._id!.toString(),
            firstName: sender.firstName,
            lastName: sender.lastName,
            userName: sender.userName,
            image: sender.image,
          },
          groupId: groupId,
          type: msg.type,
          payload: msg.payload,
          read: msg.read,
          readBy: msg.readBy?.map((id) => id.toString()) || [],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        };
      });

      return ResponseHelper.success(formattedMessages);
    } catch (err) {
      console.error("❌ Error in getGroupConversation:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

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

  private emitMessageDeleted(message: Message, userId: string): void {
    try {
      const io = getIo();
      const event: MessageDeletedEvent = {
        messageId: message._id!.toString(),
        deletedBy: userId,
      };
      console.log(`📤 Émission message_deleted pour le message ${message._id}`);
      if (message.receiver) {
        io.to(`user:${message.sender.toString()}`).emit(
          "message_deleted",
          event,
        );
        io.to(`user:${message.receiver.toString()}`).emit(
          "message_deleted",
          event,
        );
      } else if (message.groupId) {
        // Pour les messages de groupe, on pourrait émettre à tout le groupe, mais on garde simple
        io.to(`user:${message.sender.toString()}`).emit(
          "message_deleted",
          event,
        );
      }
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
      if (message.receiver) {
        io.to(`user:${message.sender.toString()}`).emit(
          "message_updated",
          response,
        );
        io.to(`user:${message.receiver.toString()}`).emit(
          "message_updated",
          response,
        );
      } else if (message.groupId) {
        io.to(`user:${message.sender.toString()}`).emit(
          "message_updated",
          response,
        );
      }
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
        ` Émission recent_chats_updated pour l'utilisateur ${userId}`,
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
      console.error(" Erreur Socket.IO:", socketError);
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
        ` Émission all_messages_deleted pour l'utilisateur ${userId}`,
      );
      io.to(`user:${userId}`).emit("all_messages_deleted", event);
    } catch (socketError) {
      console.error(" Erreur Socket.IO:", socketError);
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
      console.log(` Émission conversation_soft_deleted pour ${userId}`);
      io.to(`user:${userId}`).emit("conversation_soft_deleted", event);
    } catch (socketError) {
      console.error(" Erreur Socket.IO:", socketError);
    }
  }

  private emitMessageSoftDeleted(userId: string, messageId: string): void {
    try {
      const io = getIo();
      const event: MessageSoftDeletedEvent = {
        messageId,
        userId,
      };
      console.log(` Émission message_soft_deleted pour ${messageId}`);
      io.to(`user:${userId}`).emit("message_soft_deleted", event);
    } catch (socketError) {
      console.error(" Erreur Socket.IO:", socketError);
    }
  }

  private emitSearchResults(
    userId: string,
    results: SearchResultConversation[],
    query: string,
  ): void {
    try {
      const io = getIo();
      const event: SearchResultsEvent = {
        query,
        results,
        timestamp: new Date(),
        totalResults: results.length,
      };
      io.to(`user:${userId}`).emit("search_results", event);
    } catch (socketError) {
      console.error(" Erreur Socket.IO:", socketError);
    }
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
  async softDeleteGroupConversationForUser(
    userId: string,
    groupId: string,
  ): Promise<Response> {
    try {
      const groupObjectId = new ObjectId(groupId);
      const userObjectId = new ObjectId(userId);

      // Vérifier que l'utilisateur est membre du groupe
      const group =
        await this.friendGroupRepo.getFriendGroupById(groupObjectId);
      if (!group) return ResponseHelper.notFound("Groupe introuvable");

      const isMember =
        group.members.some((m) => m.equals(userObjectId)) ||
        group.userId.equals(userObjectId);
      if (!isMember)
        return ResponseHelper.forbidden("Vous n'êtes pas membre de ce groupe");

      const modifiedCount =
        await this.messageRepo.softDeleteGroupConversationForUser(
          groupObjectId,
          userObjectId,
        );
      return ResponseHelper.success({
        modifiedCount,
        message: "Conversation masquée pour vous",
      });
    } catch (err) {
      console.error("Error in softDeleteGroupConversationForUser:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
