// models/message.ts
import { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  DOCUMENT = "document",
}

export interface TextPayload {
  text: string;
}

export interface MediaPayload {
  url: string;
  mimeType: string;
  size?: number;
  fileName?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export type MessagePayload = TextPayload | MediaPayload;

export interface Message extends BaseModel {
  sender: ObjectId;
  receiver: ObjectId; // for one-to-one chats
  type: MessageType;
  payload: MessagePayload;
  read: boolean;
  deletedFor?: ObjectId[];

  // optional: conversationId for grouping
}
