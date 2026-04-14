import type {
  SendMessageInput,
  UpdateMessageInput,
  SendGroupMessageInput,
} from "../../models/messages/message.dto";

export interface IMessageService {
  sendMessage(senderId: string, input: SendMessageInput): Promise<Response>;
  sendMediaMessage(
    senderId: string,
    receiverId: string,
    formData: FormData,
  ): Promise<Response>;
  getConversation(userId: string, otherUserId: string): Promise<Response>;
  markAsRead(userId: string, messageIds: string[]): Promise<Response>;
  deleteMessage(userId: string, messageId: string): Promise<Response>;
  softDeleteMessage(userId: string, messageId: string): Promise<Response>;
  softDeleteConversationForUser(
    userId: string,
    otherUserId: string,
  ): Promise<Response>;
  deleteConversation(userId: string, otherUserId: string): Promise<Response>;
  getRecentChats(userId: string): Promise<Response>;
  updateMessage(
    userId: string,
    messageId: string,
    input: UpdateMessageInput,
  ): Promise<Response>;
  searchMessages(userId: string, query: string): Promise<Response>;

  sendGroupMessage(
    senderId: string,
    input: SendGroupMessageInput,
  ): Promise<Response>;
  getGroupConversation(userId: string, groupId: string): Promise<Response>;
  softDeleteGroupConversationForUser(
    userId: string,
    groupId: string,
  ): Promise<Response>;
  getGroupConversationsList(userId: string): Promise<Response>;
  leaveGroup(userId: string, groupId: string): Promise<Response>;
}
