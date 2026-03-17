import type { ObjectId } from "mongodb";
import type { Notification, NotificationType } from "../../models/notification";

export interface CreateNotificationOptions {
  userId: ObjectId;
  type: NotificationType;
  fromUser: ObjectId;
  title: string;
  description: string;
  relatedContent?: ObjectId;
  contentType?: string;
  action?: string;
  actionUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface INotificationService {
  createNotification(options: CreateNotificationOptions): Promise<Notification>;
  getNotification(id: ObjectId): Promise<Notification | null>;
  getUserNotifications(
    userId: ObjectId,
    limit?: number,
    skip?: number,
  ): Promise<Notification[]>;
  getUserUnreadNotifications(userId: ObjectId): Promise<Notification[]>;
  getUnreadCount(userId: ObjectId): Promise<number>;
  markAsRead(notificationId: ObjectId, userId: ObjectId): Promise<boolean>;
  markAllAsRead(userId: ObjectId): Promise<number>;
  deleteNotification(
    notificationId: ObjectId,
    userId: ObjectId,
  ): Promise<boolean>;
  deleteAllUserNotifications(userId: ObjectId): Promise<number>;
  getNotificationsByType(
    userId: ObjectId,
    type: string,
    limit?: number,
  ): Promise<Notification[]>;
}
