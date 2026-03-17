import { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Notification, NotificationType } from "../models/notification";
import { NotificationRepository } from "../repositories/notification-repository";
import type {
  INotificationService,
  CreateNotificationOptions,
} from "../interfaces/notification/i-notification-service";
import { BaseService } from "./base/base-service";

export class NotificationService
  extends BaseService<Notification>
  implements INotificationService
{
  private notificationRepository: NotificationRepository;

  constructor(notificationRepository?: NotificationRepository) {
    // Pass the collection to the base class
    super(CollectionsManager.notificationCollection);
    this.notificationRepository =
      notificationRepository || new NotificationRepository();
  }

  async createNotification(
    options: CreateNotificationOptions,
  ): Promise<Notification> {
    const notification: Notification = {
      _id: new ObjectId(),
      userId: options.userId,
      type: options.type,
      fromUser: options.fromUser,
      title: options.title,
      description: options.description,
      relatedContent: options.relatedContent,
      contentType: options.contentType,
      read: false,
      action: options.action,
      actionUrl: options.actionUrl,
      metadata: options.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.notificationRepository.createNotification(notification);
  }

  async getNotification(id: ObjectId): Promise<Notification | null> {
    return await this.notificationRepository.getNotificationById(id);
  }

  async getUserNotifications(
    userId: ObjectId,
    limit: number = 20,
    skip: number = 0,
  ): Promise<Notification[]> {
    return await this.notificationRepository.getUserNotifications(
      userId,
      limit,
      skip,
    );
  }

  async getUserUnreadNotifications(userId: ObjectId): Promise<Notification[]> {
    return await this.notificationRepository.getUserUnreadNotifications(userId);
  }

  async getUnreadCount(userId: ObjectId): Promise<number> {
    return await this.notificationRepository.getUnreadCount(userId);
  }

  async markAsRead(
    notificationId: ObjectId,
    userId: ObjectId,
  ): Promise<boolean> {
    // Verify the notification belongs to the user
    const notification =
      await this.notificationRepository.getNotificationById(notificationId);
    if (!notification || !notification.userId.equals(userId)) {
      return false;
    }

    return await this.notificationRepository.markAsRead(notificationId);
  }

  async markAllAsRead(userId: ObjectId): Promise<number> {
    return await this.notificationRepository.markAllAsRead(userId);
  }

  async deleteNotification(
    notificationId: ObjectId,
    userId: ObjectId,
  ): Promise<boolean> {
    // Verify the notification belongs to the user
    const notification =
      await this.notificationRepository.getNotificationById(notificationId);
    if (!notification || !notification.userId.equals(userId)) {
      return false;
    }

    return await this.notificationRepository.deleteNotification(notificationId);
  }

  async deleteAllUserNotifications(userId: ObjectId): Promise<number> {
    return await this.notificationRepository.deleteAllUserNotifications(userId);
  }

  async getNotificationsByType(
    userId: ObjectId,
    type: NotificationType,
    limit: number = 20,
  ): Promise<Notification[]> {
    return await this.notificationRepository.getNotificationsByType(
      userId,
      type,
      limit,
    );
  }

  /**
   * Send a notification to a user via socket
   * @param userId - Recipient user ID
   * @param notification - Notification object
   */
  async sendNotificationViaSocket(
    userId: ObjectId,
    notification: Notification,
  ): Promise<void> {
    try {
      const { getIo } = await import("../socket/socket-manager");
      const io = getIo();

      if (io) {
        io.to(`user:${userId}`).emit("notification:new", {
          notification,
          timestamp: new Date(),
        });

        // Also emit count update
        const unreadCount = await this.getUnreadCount(userId);
        io.to(`user:${userId}`).emit("notification:unread_count", {
          count: unreadCount,
        });

        console.log(
          `📤 Émission notification pour l'utilisateur ${userId}: ${notification.type}`,
        );
      }
    } catch (error) {
      console.error("Error sending notification via socket:", error);
    }
  }
}
