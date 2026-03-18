import { ObjectId } from "mongodb";
import { NotificationService } from "./notification-service";
import type { CreateNotificationOptions } from "../interfaces/notification/i-notification-service";
import { CollectionsManager } from "../models/base/collection-manager";

/**
 * Notification Event Handler
 * Manages creation and emission of notifications for various social activities
 */
export class NotificationEventHandler {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Notify followers when a user creates a new post
   */
  async handleNewPost(
    userId: ObjectId,
    postId: ObjectId,
    postTitle: string,
    followers: ObjectId[],
  ): Promise<void> {
    if (followers.length === 0) return;

    try {
      const user = await CollectionsManager.userCollection.findOne({
        _id: userId,
      });

      if (!user) return;

      const userName = user.userName || user.firstName;

      for (const followerId of followers) {
        const options: CreateNotificationOptions = {
          userId: followerId,
          type: "post",
          fromUser: userId,
          title: `${userName} posted new content`,
          description: postTitle,
          relatedContent: postId,
          contentType: "post",
          action: "View Post",
          actionUrl: `/posts/${postId}`,
        };

        const notification =
          await this.notificationService.createNotification(options);
        await this.notificationService.sendNotificationViaSocket(
          followerId,
          notification,
        );
      }

      console.log(
        `📬 Post notifications sent to ${followers.length} followers`,
      );
    } catch (error) {
      console.error("Error handling new post notification:", error);
    }
  }

  /**
   * Notify user when someone follows them
   */
  async handleNewFollow(
    followerId: ObjectId,
    followedUserId: ObjectId,
  ): Promise<void> {
    try {
      const followerUser = await CollectionsManager.userCollection.findOne({
        _id: followerId,
      });

      if (!followerUser) return;

      const userName = followerUser.userName || followerUser.firstName;

      const options: CreateNotificationOptions = {
        userId: followedUserId,
        type: "follow",
        fromUser: followerId,
        title: `${userName} started following you`,
        description: `${userName} (@${followerUser.userName}) is now following your profile.`,
        relatedContent: followerId,
        contentType: "user",
        action: "View Profile",
        actionUrl: `/profile/${followerId}`,
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        followedUserId,
        notification,
      );

      console.log(`📬 Follow notification sent to user ${followedUserId}`);
    } catch (error) {
      console.error("Error handling new follow notification:", error);
    }
  }

  /**
   * Notify post owner when someone comments on their post
   */
  async handleNewComment(
    commenterId: ObjectId,
    postId: ObjectId,
    postOwnerId: ObjectId,
    commentId: ObjectId,
    commentPreview: string,
  ): Promise<void> {
    if (commenterId.equals(postOwnerId)) return; // Don't notify if commenting on own post

    try {
      const commenter = await CollectionsManager.userCollection.findOne({
        _id: commenterId,
      });
      const post = await CollectionsManager.postCollection.findOne({
        _id: postId,
      });

      if (!commenter || !post) return;

      const userName = commenter.userName || commenter.firstName;
      const postTitle = (post.title || "").substring(0, 50) + "...";

      const options: CreateNotificationOptions = {
        userId: postOwnerId,
        type: "comment",
        fromUser: commenterId,
        title: `${userName} commented on your post`,
        description: commentPreview,
        relatedContent: postId,
        contentType: "comment",
        action: "View Comment",
        actionUrl: `/post/${postId}/#comment-${commentId}`,
        metadata: {
          postTitle,
          commentId: commentId.toString(),
        },
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        postOwnerId,
        notification,
      );

      console.log(`📬 Comment notification sent to user ${postOwnerId}`);
    } catch (error) {
      console.error("Error handling new comment notification:", error);
    }
  }

  /**
   * Notify post/comment owner when someone likes their content
   */
  async handleNewLike(
    likerId: ObjectId,
    contentId: ObjectId,
    contentOwnerId: ObjectId,
    contentType: "post" | "comment",
  ): Promise<void> {
    if (likerId.equals(contentOwnerId)) return; // Don't notify if liking own content

    try {
      const liker = await CollectionsManager.userCollection.findOne({
        _id: likerId,
      });

      if (!liker) return;

      const userName = liker.userName || liker.firstName;

      let title = `${userName} liked your post`;
      const actionUrl = `/post/${contentId}`;

      if (contentType === "comment") {
        title = `${userName} liked your comment`;
      }

      const options: CreateNotificationOptions = {
        userId: contentOwnerId,
        type: "like",
        fromUser: likerId,
        title,
        description: `${userName} reacted to your ${contentType}`,
        relatedContent: contentId,
        contentType,
        action: "View",
        actionUrl,
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        contentOwnerId,
        notification,
      );

      console.log(
        `📬 Like notification sent to user ${contentOwnerId} for ${contentType}`,
      );
    } catch (error) {
      console.error("Error handling new like notification:", error);
    }
  }

  /**
   * Notify user when they're mentioned in a post or comment
   */
  async handleMention(
    mentionedUserId: ObjectId,
    mentionerUserId: ObjectId,
    contentId: ObjectId,
    contentType: "post" | "comment",
    contentPreview: string,
  ): Promise<void> {
    if (mentionerUserId.equals(mentionedUserId)) return; // Don't notify self mentions

    try {
      const mentioner = await CollectionsManager.userCollection.findOne({
        _id: mentionerUserId,
      });

      if (!mentioner) return;

      const userName = mentioner.userName || mentioner.firstName;

      const options: CreateNotificationOptions = {
        userId: mentionedUserId,
        type: "mention",
        fromUser: mentionerUserId,
        title: `${userName} mentioned you`,
        description: contentPreview,
        relatedContent: contentId,
        contentType,
        action: "View",
        actionUrl:
          contentType === "post"
            ? `/posts/${contentId}`
            : `/posts/${contentId}/#comment-${contentId}`,
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        mentionedUserId,
        notification,
      );

      console.log(`📬 Mention notification sent to user ${mentionedUserId}`);
    } catch (error) {
      console.error("Error handling mention notification:", error);
    }
  }

  /**
   * Notify message recipient
   */
  async handleNewMessage(
    senderId: ObjectId,
    recipientId: ObjectId,
    messageId: ObjectId,
    messagePreview: string,
  ): Promise<void> {
    try {
      const sender = await CollectionsManager.userCollection.findOne({
        _id: senderId,
      });

      if (!sender) return;

      const senderName = sender.userName || sender.firstName;

      const options: CreateNotificationOptions = {
        userId: recipientId,
        type: "message",
        fromUser: senderId,
        title: `New message from ${senderName}`,
        description: messagePreview,
        relatedContent: messageId,
        contentType: "message",
        action: "Open Chat",
        actionUrl: `/messages/${senderId}`,
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        recipientId,
        notification,
      );

      console.log(`📬 Message notification sent to user ${recipientId}`);
    } catch (error) {
      console.error("Error handling new message notification:", error);
    }
  }

  /**
   * Notify community members when a new post is created in the community
   */
  async handleCommunityPost(
    posterId: ObjectId,
    communityId: ObjectId,
    postId: ObjectId,
    postTitle: string,
    communityMembers: ObjectId[],
  ): Promise<void> {
    if (communityMembers.length === 0) return;

    try {
      const poster = await CollectionsManager.userCollection.findOne({
        _id: posterId,
      });

      if (!poster) return;

      const posterName = poster.userName || poster.firstName;

      const community = await CollectionsManager.communityCollection.findOne({
        _id: communityId,
      });
      const communityName = community?.name || "Community";

      for (const memberId of communityMembers) {
        if (memberId.equals(posterId)) continue; // Don't notify self

        const options: CreateNotificationOptions = {
          userId: memberId,
          type: "community_post",
          fromUser: posterId,
          title: `${posterName} posted in ${communityName}`,
          description: postTitle,
          relatedContent: postId,
          contentType: "post",
          action: "View Post",
          actionUrl: `/posts/${postId}`,
          metadata: {
            communityId: communityId.toString(),
            communityName,
          },
        };

        const notification =
          await this.notificationService.createNotification(options);
        await this.notificationService.sendNotificationViaSocket(
          memberId,
          notification,
        );
      }

      console.log(
        `📬 Community post notifications sent to ${communityMembers.length} members`,
      );
    } catch (error) {
      console.error("Error handling community post notification:", error);
    }
  }

  /**
   * Notifier les admins quand un nouveau membre rejoint
   */
  async handleCommunityJoin(
    newMemberId: ObjectId,
    adminId: ObjectId,
    communityId: ObjectId,
    communityName: string,
    memberName: string,
  ): Promise<void> {
    try {
      const options: CreateNotificationOptions = {
        userId: adminId,
        type: "community_join",
        fromUser: newMemberId,
        title: `Nouveau membre dans r/${communityName}`,
        description: `${memberName} a rejoint la communauté`,
        relatedContent: communityId,
        contentType: "community",
        action: "Voir les membres",
        actionUrl: `/community/${communityId}`,
        metadata: {
          communityName,
          memberName,
        },
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        adminId,
        notification,
      );

      console.log(`📬 Community join notification sent to admin ${adminId}`);
    } catch (error) {
      console.error("Error handling community join notification:", error);
    }
  }
  /**
   * Notifier le propriétaire d'une entreprise quand quelqu'un la suit
   */
  async handleCompanyFollow(
    followerId: ObjectId,
    companyOwnerId: ObjectId,
    companyId: ObjectId,
    companyName: string,
    followerName: string,
  ): Promise<void> {
    try {
      // Ne pas notifier si c'est le propriétaire qui suit sa propre entreprise
      if (followerId.equals(companyOwnerId)) return;

      const options: CreateNotificationOptions = {
        userId: companyOwnerId,
        type: "company_follow",
        fromUser: followerId,
        title: `Nouveau follower pour votre entreprise`,
        description: `${followerName} suit maintenant ${companyName}`,
        relatedContent: companyId,
        contentType: "company",
        action: "Voir l'entreprise",
        actionUrl: `/companies/${companyId}`,
        metadata: {
          companyName,
          followerName,
          companyId: companyId.toString(),
        },
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        companyOwnerId,
        notification,
      );

      console.log(`📬 Company follow notification sent to ${companyOwnerId}`);
    } catch (error) {
      console.error("Error handling company follow notification:", error);
    }
  }
}
