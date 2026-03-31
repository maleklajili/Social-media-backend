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

      console.log(` Comment notification sent to user ${postOwnerId}`);
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
  // Add this method to your NotificationEventHandler class

  /**
   * Notifier le propriétaire d'une entreprise quand sa demande de vérification est traitée
   */
  async handleCompanyVerification(
    companyOwnerId: ObjectId,
    companyId: ObjectId,
    companyName: string,
    status: "verified" | "rejected",
    notes?: string,
  ): Promise<void> {
    try {
      const isVerified = status === "verified";

      const options: CreateNotificationOptions = {
        userId: companyOwnerId,
        type: "company_verification",
        fromUser: companyOwnerId,
        title: isVerified
          ? "Votre entreprise a été vérifiée !"
          : "Demande de vérification refusée",
        description: isVerified
          ? `Félicitations ! Votre entreprise "${companyName}" a été vérifiée avec succès. Vous bénéficiez désormais du badge de confiance et de tous les avantages réservés aux entreprises vérifiées.`
          : `Nous sommes au regret de vous informer que la demande de vérification de votre entreprise "${companyName}" a été refusée.${notes ? ` Motif : ${notes}` : ""} Vous pouvez soumettre une nouvelle demande avec des documents supplémentaires.`,
        relatedContent: companyId,
        contentType: "company",
        action: isVerified
          ? "Voir mon entreprise"
          : "Soumettre une nouvelle demande",
        actionUrl: `/companies/${companyId}`,
        metadata: {
          companyName,
          companyId: companyId.toString(),
          verificationStatus: status,
          verificationNotes: notes,
        },
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        companyOwnerId,
        notification,
      );

      console.log(
        ` Company verification notification sent to owner ${companyOwnerId} (status: ${status})`,
      );
    } catch (error) {
      console.error("Error handling company verification notification:", error);
    }
  }

  /**
   * Notifier l'admin quand une nouvelle demande de vérification est soumise
   */
  async handleNewVerificationRequest(
    companyOwnerId: ObjectId,
    companyId: ObjectId,
    companyName: string,
    adminIds: ObjectId[],
  ): Promise<void> {
    if (!adminIds || adminIds.length === 0) return;

    try {
      const companyOwner = await CollectionsManager.userCollection.findOne({
        _id: companyOwnerId,
      });

      const ownerName =
        companyOwner?.userName || companyOwner?.firstName || "Un utilisateur";

      for (const adminId of adminIds) {
        const options: CreateNotificationOptions = {
          userId: adminId,
          type: "verification_request",
          fromUser: companyOwnerId,
          title: " Nouvelle demande de vérification",
          description: `${ownerName} a soumis une demande de vérification pour l'entreprise "${companyName}". Veuillez examiner les documents fournis.`,
          relatedContent: companyId,
          contentType: "company",
          action: "Examiner la demande",
          actionUrl: `/admin/verification-requests/${companyId}`,
          metadata: {
            companyName,
            companyId: companyId.toString(),
            ownerName,
            ownerId: companyOwnerId.toString(),
          },
        };

        const notification =
          await this.notificationService.createNotification(options);
        await this.notificationService.sendNotificationViaSocket(
          adminId,
          notification,
        );
      }

      console.log(
        `New verification request notifications sent to ${adminIds.length} admins`,
      );
    } catch (error) {
      console.error(
        "Error handling new verification request notification:",
        error,
      );
    }
  }

  /**
   * Notifier l'admin quand une demande de vérification est mise à jour
   */
  async handleVerificationRequestUpdate(
    companyId: ObjectId,
    companyName: string,
    adminId: ObjectId,
    updateType: "new_documents" | "status_change" | "additional_info",
    previousStatus?: string,
    newStatus?: string,
  ): Promise<void> {
    try {
      let title = "";
      let description = "";

      switch (updateType) {
        case "new_documents":
          title = " Nouveaux documents ajoutés";
          description = `L'entreprise "${companyName}" a ajouté de nouveaux documents pour sa demande de vérification.`;
          break;
        case "status_change":
          title = " Changement de statut";
          description = `La demande de vérification de "${companyName}" est passée de ${previousStatus} à ${newStatus}.`;
          break;
        case "additional_info":
          title = "ℹ Informations complémentaires";
          description = `L'entreprise "${companyName}" a ajouté des informations supplémentaires à sa demande de vérification.`;
          break;
      }

      const options: CreateNotificationOptions = {
        userId: adminId,
        type: "verification_request_update",
        fromUser: companyId,
        title,
        description,
        relatedContent: companyId,
        contentType: "company",
        action: "Voir la demande",
        actionUrl: `/admin/verification-requests/${companyId}`,
        metadata: {
          companyName,
          companyId: companyId.toString(),
          updateType,
          previousStatus,
          newStatus,
        },
      };

      const notification =
        await this.notificationService.createNotification(options);
      await this.notificationService.sendNotificationViaSocket(
        adminId,
        notification,
      );

      console.log(
        ` Verification request update notification sent to admin ${adminId}`,
      );
    } catch (error) {
      console.error(
        "Error handling verification request update notification:",
        error,
      );
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
