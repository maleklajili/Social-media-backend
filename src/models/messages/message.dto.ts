import { MessageType, type MessagePayload } from "./message";

export interface SendMessageInput {
  receiverId: string;
  type: MessageType;
  payload: MessagePayload;
}

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
  payload: MessagePayload;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}
