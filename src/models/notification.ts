import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";

export type NotificationType =
  | "follow"
  | "post"
  | "message"
  | "like"
  | "comment"
  | "mention"
  | "community_post"
  | "community_join"
  | "company_follow"
  | "job_application";

export type NotificationContentType =
  | "post"
  | "comment"
  | "message"
  | "user"
  | "job";

export interface Notification extends BaseModel {
  /** User ID of the notification recipient */
  userId: ObjectId;

  /** Type of notification */
  type: NotificationType;

  /** User ID of who triggered the notification */
  fromUser: ObjectId;

  /** ID of the related content (post, comment, message, etc.) */
  relatedContent?: ObjectId;

  /** Type of related content */
  contentType?: NotificationContentType | string;

  /** Notification title/summary */
  title: string;

  /** Detailed description */
  description: string;

  /** Whether the notification has been read */
  read: boolean;

  /** Date when notification was read */
  readAt?: Date;

  /** Optional action label (e.g., "View Post", "Accept Request") */
  action?: string;

  /** Optional action URL slug (e.g., "/posts/123", "/profile/userId") */
  actionUrl?: string;

  /** Optional additional metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}
