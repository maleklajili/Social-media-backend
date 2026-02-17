// types/message.dto.ts
import {
  MessageType,
  type MessagePayload,
} from "../../models/messages/message";

export interface SendMessageInput {
  receiverId: string;
  type: MessageType;
  payload: MessagePayload;
}
// types/message.dto.ts
export interface MarkAsReadInput {
  messageIds: string[];
}
export interface UpdateMessageInput {
  payload: MessagePayload;
}
export interface MessageResponse {
  _id: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    image?: string;
  };
  receiver: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    image?: string;
  };
  type: MessageType;
  payload: MessagePayload; // Plus de any, utilisation du type union du modèle
  read: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
