import { MessageType, type MessagePayload } from "./message";

export interface SendMessageInput {
  receiverId: string;
  type: MessageType;
  payload: MessagePayload;
}

export interface SendGroupMessageInput {
  groupId: string;
  text: string;
}

export interface MarkAsReadInput {
  messageIds: string[];
}

export interface UpdateMessageInput {
  payload: MessagePayload;
}

export interface CallResponse {
  callId: string;
  status: "initiated" | "answered" | "ended" | "missed";
  duration?: number;
  startedAt: Date;
  endedAt?: Date;
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
  receiver?: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    image?: string;
  };
  groupId?: string;
  type: MessageType;
  payload: MessagePayload;
  read: boolean;
  readBy?: string[];
  createdAt: Date;
  updatedAt: Date;
}
