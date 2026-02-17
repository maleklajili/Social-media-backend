// interfaces/message/i-message-service.ts
import type {
  SendMessageInput,
  UpdateMessageInput,
} from "../../models/messages/message.dto";

export interface IMessageService {
  /**
   * Envoyer un message (texte, image, vidéo, document)
   */
  sendMessage(senderId: string, input: SendMessageInput): Promise<Response>;

  /**
   * Récupérer la conversation entre deux utilisateurs
   */
  getConversation(userId: string, otherUserId: string): Promise<Response>;

  /**
   * Marquer des messages comme lus
   */
  markAsRead(userId: string, messageIds: string[]): Promise<Response>;

  /**
   * Supprimer un message spécifique (seulement si l'utilisateur est l'expéditeur)
   */
  deleteMessage(userId: string, messageId: string): Promise<Response>;

  /**
   * Supprimer toute une conversation entre deux utilisateurs
   */
  deleteConversation(userId: string, otherUserId: string): Promise<Response>;

  updateMessage(
    userId: string,
    messageId: string,
    input: UpdateMessageInput,
  ): Promise<Response>;
  /**
   * Récupérer les derniers messages avec chaque contact (liste des discussions)
   */
  getRecentChats(userId: string): Promise<Response>;

  /**
   * Supprimer tous les messages entre
   */
  deleteAllMessagesByUser(userId: string): Promise<Response>;
  /**delete pour moi unique */
  softDeleteConversationForUser(
    userId: string,
    otherUserId: string,
  ): Promise<Response>;
  softDeleteMessage(userId: string, messageId: string): Promise<Response>;
}
