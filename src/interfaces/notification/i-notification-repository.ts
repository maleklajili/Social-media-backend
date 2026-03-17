import type { ObjectId } from "mongodb";
import type { Notification } from "../../models/notification";

export interface INotificationRepository {
  createNotification(notification: Notification): Promise<Notification>;
  getNotificationById(id: ObjectId): Promise<Notification | null>;
  getUserNotifications(
    userId: ObjectId,
    limit?: number,
    skip?: number,
  ): Promise<Notification[]>;
  getUserUnreadNotifications(userId: ObjectId): Promise<Notification[]>;
  getUnreadCount(userId: ObjectId): Promise<number>;
  markAsRead(notificationId: ObjectId): Promise<boolean>;
  markAllAsRead(userId: ObjectId): Promise<number>;
  deleteNotification(notificationId: ObjectId): Promise<boolean>;
  deleteUserNotification(
    userId: ObjectId,
    notificationId: ObjectId,
  ): Promise<boolean>;
  deleteAllUserNotifications(userId: ObjectId): Promise<number>;
  getNotificationsByType(
    userId: ObjectId,
    type: string,
    limit?: number,
  ): Promise<Notification[]>;
  getRelatedNotifications(
    userId: ObjectId,
    relatedContent: ObjectId,
  ): Promise<Notification[]>;
  deleteRelatedNotifications(
    userId: ObjectId,
    relatedContent: ObjectId,
    type?: string,
  ): Promise<number>;
  updateNotification(
    notificationId: ObjectId,
    data: Partial<Notification>,
  ): Promise<boolean>;
}
