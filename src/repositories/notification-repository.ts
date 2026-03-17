import { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Notification, NotificationType } from "../models/notification";
import type { INotificationRepository } from "../interfaces/notification/i-notification-repository";

export class NotificationRepository implements INotificationRepository {
  private collection = CollectionsManager.notificationCollection;

  async createNotification(notification: Notification): Promise<Notification> {
    const result = await this.collection.insertOne(notification);
    return { ...notification, _id: result.insertedId };
  }

  async getNotificationById(id: ObjectId): Promise<Notification | null> {
    return this.collection.findOne({ _id: id });
  }

  async getUserNotifications(
    userId: ObjectId,
    limit: number = 20,
    skip: number = 0,
  ): Promise<Notification[]> {
    return this.collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();
  }

  async getUserUnreadNotifications(userId: ObjectId): Promise<Notification[]> {
    return this.collection
      .find({ userId, read: false })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getUnreadCount(userId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ userId, read: false });
  }

  async markAsRead(notificationId: ObjectId): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: notificationId },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount === 1;
  }

  async markAllAsRead(userId: ObjectId): Promise<number> {
    const result = await this.collection.updateMany(
      { userId, read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount;
  }

  async deleteNotification(notificationId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: notificationId });
    return result.deletedCount === 1;
  }

  async deleteUserNotification(
    userId: ObjectId,
    notificationId: ObjectId,
  ): Promise<boolean> {
    const result = await this.collection.deleteOne({
      _id: notificationId,
      userId,
    });
    return result.deletedCount === 1;
  }

  async deleteAllUserNotifications(userId: ObjectId): Promise<number> {
    const result = await this.collection.deleteMany({ userId });
    return result.deletedCount;
  }

  async getNotificationsByType(
    userId: ObjectId,
    type: NotificationType,
    limit: number = 20,
  ): Promise<Notification[]> {
    return this.collection
      .find({ userId, type })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getRelatedNotifications(
    userId: ObjectId,
    relatedContent: ObjectId,
  ): Promise<Notification[]> {
    return this.collection
      .find({ userId, relatedContent })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async deleteRelatedNotifications(
    userId: ObjectId,
    relatedContent: ObjectId,
    type?: string,
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { userId, relatedContent };
    if (type) {
      query.type = type;
    }
    const result = await this.collection.deleteMany(query);
    return result.deletedCount;
  }

  async updateNotification(
    notificationId: ObjectId,
    data: Partial<Notification>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: notificationId },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount === 1;
  }
}
