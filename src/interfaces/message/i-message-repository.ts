import { ObjectId } from "mongodb";
import type { Message, MessagePayload } from "../../models/messages/message";

export interface IMessageRepository {
  sendMessage(message: Message): Promise<void>;
  getConversation(
    user1Id: ObjectId,
    user2Id: ObjectId,
    currentUserId: ObjectId,
  ): Promise<Message[]>;
  markAsRead(messageIds: ObjectId[]): Promise<void>;
  getMessageById(id: ObjectId): Promise<Message | null>;
  deleteMessage(id: ObjectId, userId: ObjectId): Promise<boolean>;
  deleteConversation(user1Id: ObjectId, user2Id: ObjectId): Promise<number>;
  updateMessage(
    messageId: ObjectId,
    userId: ObjectId,
    payload: MessagePayload,
  ): Promise<boolean>;
  getRecentChats(userId: ObjectId): Promise<Message[]>;
  deleteAllMessagesByUser(userId: ObjectId): Promise<number>;
  findMessagesByIds(ids: ObjectId[]): Promise<Message[]>;
  softDeleteConversationForUser(
    user1Id: ObjectId,
    user2Id: ObjectId,
    userId: ObjectId,
  ): Promise<number>;
  countUnreadMessages(userId: ObjectId, otherUserId: ObjectId): Promise<number>;
  softDeleteMessage(messageId: ObjectId, userId: ObjectId): Promise<boolean>;
  getMessageMediaUrl(messageId: ObjectId): Promise<string | null>;
  searchMessages(userId: ObjectId, query: string): Promise<Message[]>;
}
