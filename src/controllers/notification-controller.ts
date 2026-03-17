import { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import { BaseController } from "./base/base-controller";
import type { Notification, NotificationType } from "../models/notification";
import { NotificationService } from "../services/notification-service";
import { ResponseHelper } from "../utils/response-helper";
import { Get, Put, Delete } from "../routes/router-manager";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { RequestWithPagination } from "../config/interfaces/i-pagination";
import { getIo } from "../socket/socket-manager";

export class NotificationController extends BaseController<
  Notification,
  NotificationService
> {
  private notificationService: NotificationService;

  constructor() {
    super("/notifications");
    this.notificationService = new NotificationService();
    this.initializeService(this.notificationService);
  }

  protected initializeCollection() {
    return CollectionsManager.notificationCollection;
  }

  protected createService(): NotificationService {
    return new NotificationService();
  }

  /**
   * GET /notifications - Get user's notifications
   */
  @Get("/")
  async getUserNotifications(req: RequestWithPagination): Promise<Response> {
    try {
      // Get userId from auth middleware
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const limit = req.pagination?.take || 20;
      const skip = req.pagination?.skip || 0;

      const notifications = await this.notificationService.getUserNotifications(
        userObjectId,
        limit,
        skip,
      );

      return ResponseHelper.success({
        notifications,
        count: notifications.length,
      });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /notifications/unread - Get unread notifications count
   */
  @Get("/unread")
  async getUnreadCount(req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const count = await this.notificationService.getUnreadCount(userObjectId);

      return ResponseHelper.success({ unreadCount: count });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /notifications/unread/list - Get unread notifications
   */
  @Get("/unread/list")
  async getUnreadNotifications(req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const notifications =
        await this.notificationService.getUserUnreadNotifications(userObjectId);

      return ResponseHelper.success(notifications);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /notifications/:id - Get specific notification
   */
  @Get("/:id")
  async getNotification(_id: ObjectId, req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const notification = await this.notificationService.getNotification(_id);
      if (!notification) {
        return ResponseHelper.notFound("Notification not found");
      }

      // Verify ownership
      if (!notification.userId.equals(new ObjectId(userId))) {
        return ResponseHelper.forbidden("You cannot access this notification");
      }

      return ResponseHelper.success(notification);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /notifications/:id/read - Mark notification as read
   */
  @Put("/:id/read")
  async markAsRead(_id: ObjectId, req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const success = await this.notificationService.markAsRead(
        _id,
        userObjectId,
      );

      if (!success) {
        return ResponseHelper.notFound("Notification not found");
      }

      // Update unread count
      const unreadCount =
        await this.notificationService.getUnreadCount(userObjectId);
      const io = getIo();
      if (io) {
        io.to(`user:${userObjectId}`).emit("notification:unread_count", {
          count: unreadCount,
        });
      }

      return ResponseHelper.success({ marked: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * PUT /notifications/read/all - Mark all notifications as read
   */
  @Put("/read/all")
  async markAllAsRead(req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const count = await this.notificationService.markAllAsRead(userObjectId);

      // Update unread count
      const unreadCount =
        await this.notificationService.getUnreadCount(userObjectId);
      const io = getIo();
      if (io) {
        io.to(`user:${userObjectId}`).emit("notification:unread_count", {
          count: unreadCount,
        });
      }

      return ResponseHelper.success({ markedCount: count });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * DELETE /notifications/:id - Delete notification
   */
  @Delete("/:id")
  async deleteNotification(
    _id: ObjectId,
    req: ServerRequest,
  ): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const success = await this.notificationService.deleteNotification(
        _id,
        userObjectId,
      );

      if (!success) {
        return ResponseHelper.notFound("Notification not found");
      }

      return ResponseHelper.success({ deleted: true });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * DELETE /notifications - Delete all notifications
   */
  @Delete("/")
  async deleteAllNotifications(req: ServerRequest): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const count =
        await this.notificationService.deleteAllUserNotifications(userObjectId);

      return ResponseHelper.success({ deletedCount: count });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * GET /notifications/type/:type - Get notifications by type
   */
  @Get("/type/:type")
  async getNotificationsByType(
    type: NotificationType,
    req: ServerRequest,
  ): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).userId;
      if (!userId) {
        return ResponseHelper.unauthorized("Not authenticated");
      }

      const userObjectId = new ObjectId(userId);
      const notifications =
        await this.notificationService.getNotificationsByType(
          userObjectId,
          type,
        );

      return ResponseHelper.success(notifications);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  /**
   * Socket event handlers for notifications
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSocketHandlers(socket: any) {
    const userId = socket.data.userId;

    // Get unread count
    socket.on("notification:get_unread_count", async () => {
      try {
        const count = await this.notificationService.getUnreadCount(
          new ObjectId(userId),
        );
        socket.emit("notification:unread_count", { count });
      } catch (error) {
        console.error("Error getting unread count:", error);
      }
    });

    // Get notifications
    socket.on(
      "notification:get_notifications",
      async (data: { limit?: number; skip?: number }) => {
        try {
          const notifications =
            await this.notificationService.getUserNotifications(
              new ObjectId(userId),
              data.limit || 20,
              data.skip || 0,
            );
          socket.emit("notification:notifications_list", {
            notifications,
          });
        } catch (error) {
          console.error("Error getting notifications:", error);
        }
      },
    );

    // Mark as read
    socket.on(
      "notification:mark_as_read",
      async (data: { notificationId: string }) => {
        try {
          const success = await this.notificationService.markAsRead(
            new ObjectId(data.notificationId),
            new ObjectId(userId),
          );
          if (success) {
            const count = await this.notificationService.getUnreadCount(
              new ObjectId(userId),
            );
            socket.emit("notification:unread_count", { count });
          }
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      },
    );

    // Mark all as read
    socket.on("notification:mark_all_as_read", async () => {
      try {
        await this.notificationService.markAllAsRead(new ObjectId(userId));
        socket.emit("notification:unread_count", { count: 0 });
      } catch (error) {
        console.error("Error marking all as read:", error);
      }
    });

    // Delete notification
    socket.on(
      "notification:delete",
      async (data: { notificationId: string }) => {
        try {
          await this.notificationService.deleteNotification(
            new ObjectId(data.notificationId),
            new ObjectId(userId),
          );
          socket.emit("notification:deleted", {
            notificationId: data.notificationId,
          });
        } catch (error) {
          console.error("Error deleting notification:", error);
        }
      },
    );
  }
}
