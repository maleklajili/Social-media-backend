import { ObjectId } from "mongodb";
import { BaseService } from "../base/base-service";
import type { Post } from "../../models/post";
import type { IPostService } from "../../interfaces/post/i-post-service";
import { CommentRepository } from "../../repositories/comment/comment-repository";
import type { IPostRepository } from "../../interfaces/post/i-post-repository";
import type { IUserRepository } from "../../interfaces/user/i-user-repository";
import type { TransactionService } from "../transaction-services";
import { CollectionsManager } from "../../models/base/collection-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { COINS_CONFIG } from "../../utils/coins-config";
import { FileService } from "../../utils/file-service";
import type { Comment } from "../../models/comment";
import { UPLOAD_PATHS } from "../../config/config";
import { handleFileUpload, type UploadResult } from "../../utils/upload-helper";
import populateReferences from "../../utils/populate";
import type { ICommentRepository } from "../../interfaces/comment/i-comment-repository";
import type { ICommunityRepository } from "../../interfaces/community/i-community-repository";
import { CommunityRepository } from "../../repositories/community-repository";
import { NotificationEventHandler } from "../notification-event-handler";
import { ContentModeratorClient } from "../../utils/content-moderator-client";
import type { ICompanyRepository } from "../../interfaces/company/i-company-repository";
import { CompanyRepository } from "../../repositories/company-repository";
export class PostServices extends BaseService<Post> implements IPostService {
  private commentRepository: ICommentRepository;
  private communityRepository: ICommunityRepository;
  private companyRepository: ICompanyRepository;
  private notificationHandler: NotificationEventHandler;
  constructor(
    private postRepository: IPostRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,

    commentRepository?: ICommentRepository,
    communityRepository?: ICommunityRepository,
    companyRepository?: ICompanyRepository,
  ) {
    super(CollectionsManager.postCollection);
    this.commentRepository = commentRepository || new CommentRepository();
    this.communityRepository = communityRepository || new CommunityRepository();
    this.companyRepository = companyRepository || new CompanyRepository();

    this.notificationHandler = new NotificationEventHandler();
  }
  async getAllPosts(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const posts = await this.collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate userId
    try {
      await populateReferences(posts, this.userRepository, "userId");
    } catch (err) {
      console.error("Failed to populate users for posts:", err);
    }

    // Ajouter ownerData pour les posts d'entreprise
    for (const post of posts) {
      if (post.ownerType === "company" && post.ownerId) {
        try {
          const company = await this.companyRepository.getCompanyById(
            post.ownerId,
          );
          if (company && company._id) {
            post.ownerData = {
              _id: company._id,
              name: company.name || "",
              logo: company.logo || "",
              userId: company.userId || "",
            };
          }
        } catch (err) {
          console.error("Failed to populate company data for post:", err);
        }
      }
    }

    const totalPosts = await this.collection.countDocuments();
    const publishedPosts = await this.collection.countDocuments({
      status: "published",
    });
    const flaggedPosts = await this.collection.countDocuments({
      status: "flagged",
    });

    const viewsAgg = await this.collection
      .aggregate([{ $group: { _id: null, totalViews: { $sum: "$views" } } }])
      .toArray();
    const totalViews = viewsAgg[0]?.totalViews || 0;

    return {
      posts,
      totalPosts,
      publishedPosts,
      flaggedPosts,
      totalViews,
    };
  }
  async createPost(
    userId: ObjectId,
    post: Post,
    formData: FormData,
    ownerType: "user" | "company" = "user",
    ownerId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!post.title) {
        return ResponseHelper.error("Title is required");
      }

      // Set owner information
      post.ownerType = ownerType;
      post.userId = userId; // logged user (creator)

      if (ownerType === "company" && ownerId) {
        // Check if user owns this company
        const company = await this.companyRepository.getCompanyById(ownerId);
        if (!company) {
          return ResponseHelper.error("Company not found");
        }

        // Check if user is admin of this company
        const isAdmin = company.userId.equals(userId);
        if (!isAdmin) {
          return ResponseHelper.error(
            "You don't have permission to post as this company",
          );
        }

        post.ownerId = ownerId;
      } else {
        post.ownerType = "user";
        post.ownerId = userId;
      }

      // Rest of the existing code...
      const privacyValue = formData.get("privacy") as string;
      if (
        privacyValue &&
        ["public", "friends", "private"].includes(privacyValue)
      ) {
        post.privacy = privacyValue as "public" | "friends" | "private";
      } else {
        post.privacy = "friends";
      }

      post.votes = 0;
      post.commentsCount = 0;
      post.views = 0;
      post.shares = 0;
      post.saves = 0;
      post.createdAt = new Date();
      post.updatedAt = new Date();
      post.lastActivityAt = new Date();

      if (post.community && typeof post.community === "string") {
        if (ObjectId.isValid(post.community)) {
          post.community = new ObjectId(post.community as string);
        } else {
          return ResponseHelper.error("Invalid community ID format");
        }
      }

      // Handle media based on type
      switch (post.type) {
        case "image":
          await this.handleImagePost(post, formData, userId);
          break;
        case "video":
          await this.handleVideoPost(post, formData, userId);
          break;
        case "link":
          if (!post.url) {
            return ResponseHelper.error("URL is required for link posts");
          }
          break;
        case "gallery":
          await this.handleGalleryPost(post, formData, userId);
          break;
      }

      post.trendingScore = this.calculateTrendingScore(post);

      // AI Moderation
      try {
        const textToCheck = `${post.title || ""} ${post.content || ""}`.trim();
        if (textToCheck) {
          const modResult =
            await ContentModeratorClient.checkToxicity(textToCheck);
          post.toxicityScore = modResult.score;
          post.toxicityCategories = modResult.categories;

          if (modResult.toxic) {
            post.flagged = true;
            post.moderationStatus = "flagged";
            post.moderationReason = modResult.reason;
          } else {
            post.flagged = false;
            post.moderationStatus = "approved";
          }
        }
      } catch (err) {
        console.error("AI moderation check failed:", err);
        post.moderationStatus = "pending";
      }

      await this.postRepository.addPost(post);

      if (ownerType === "company" && ownerId && post._id) {
        await this.companyRepository.addPostToCompany(ownerId, post._id);
      }

      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.CREATE_POST);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.CREATE_POST,
          "post",
          post._id!,
          `Création d'un post (${ownerType})`,
          {
            title: post.title,
            type: post.type,
            ownerType: ownerType,
            community: post.community,
          },
        );
      } catch (err) {
        console.error("Error adding coins:", err);
      }

      return ResponseHelper.success(post);
    } catch (err) {
      console.error("Error creating post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getPostsByOwner(
    ownerId: ObjectId,
    ownerType: "user" | "company",
  ): Promise<Response> {
    try {
      const posts = await this.postRepository.getPostsByOwner(
        ownerId,
        ownerType,
      );

      // Populate creator (userId)
      try {
        await populateReferences(posts, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate user for posts:", err);
      }

      // Populate owner info based on type
      if (ownerType === "company") {
        const company = await this.companyRepository.getCompanyById(ownerId);
        if (company && company._id) {
          posts.forEach((post) => {
            post.ownerData = {
              _id: company._id as ObjectId, // ← Assertion de type
              name: company.name || "",
              logo: company.logo || "",
              userId: company.userId || "",
            };
          });
        }
      }

      return ResponseHelper.success(posts);
    } catch (err) {
      console.error("Error getting posts by owner:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async updatePost(
    userId: ObjectId,
    postId: ObjectId,
    post: Post,
    formData: FormData,
  ): Promise<Response> {
    try {
      const existingPost = await this.collection.findOne({
        _id: postId,
        userId: userId,
      });

      if (!existingPost) {
        return ResponseHelper.error("Post non trouvé ou accès refusé");
      }

      post._id = postId;
      post.userId = userId;
      post.updatedAt = new Date();

      // Initialiser post.media si non défini
      if (!post.media) {
        post.media = [];
      }

      // Obtenir les fichiers à supprimer
      const fichiersASupprimer: string[] = [];

      // Vérifier si de nouveaux fichiers multimédias sont téléchargés
      if (formData.has("media")) {
        // Obtenir les IDs des fichiers à conserver (envoyés par le frontend)
        const mediaIdsAConserver = formData.get("keepMediaIds") as string;
        const idsAConserver = mediaIdsAConserver
          ? mediaIdsAConserver.split(",")
          : [];

        // Identifier les fichiers à supprimer (fichiers existants qui ne sont pas dans la liste de conservation)
        if (existingPost.media && existingPost.media.length > 0) {
          existingPost.media.forEach((media) => {
            if (!idsAConserver.includes(media.id)) {
              fichiersASupprimer.push(media.url);
            }
          });
        }

        // Traiter les nouveaux fichiers téléchargés
        await this.handlePostMedia(post, formData, userId);

        // Fusionner les fichiers conservés et les nouveaux fichiers
        const fichiersConserves =
          existingPost.media?.filter((m) => idsAConserver.includes(m.id)) || [];
        const nouveauxFichiers = post.media || [];

        // Utiliser la méthode push pour éviter l'erreur de décomposition
        post.media = [];

        if (fichiersConserves.length > 0) {
          post.media.push(...fichiersConserves);
        }

        if (nouveauxFichiers.length > 0) {
          post.media.push(...nouveauxFichiers);
        }

        // Réordonner les fichiers
        if (post.media && post.media.length > 0) {
          post.media.forEach((media, index) => {
            media.order = index;
          });
        }
      } else {
        // Si pas de nouveaux fichiers, conserver les fichiers existants
        post.media = existingPost.media || [];
      }

      // Supprimer les fichiers si nécessaire
      if (fichiersASupprimer.length > 0) {
        await FileService.deleteMultipleFiles(
          fichiersASupprimer,
          userId.toString(),
        );
      }

      await this.postRepository.updatePost(post);
      return ResponseHelper.success(post);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getStats(): Promise<Response> {
    try {
      const totalPosts = await this.collection.countDocuments();
      const publishedPosts = await this.collection.countDocuments({
        status: "published",
      });
      const flaggedPosts = await this.collection.countDocuments({
        status: "flagged",
      });
      const viewsAgg = await this.collection
        .aggregate([{ $group: { _id: null, totalViews: { $sum: "$views" } } }])
        .toArray();
      const totalViews = viewsAgg[0]?.totalViews || 0;
      return ResponseHelper.success({
        totalPosts,
        publishedPosts,
        flaggedPosts,
        totalViews,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
  async deletePost(userId: ObjectId, postId: ObjectId): Promise<Response> {
    try {
      const existingPost = await this.collection.findOne({
        _id: postId,
        userId: userId,
      });

      /* if (!existingPost) {
        return ResponseHelper.error("Post not found or access denied");
      } */

      if (existingPost?.media?.length) {
        await FileService.deleteMultipleFiles(
          existingPost.media.map((m) => m.url),
          userId.toString(),
        );
      }

      await this.postRepository.deletePost(postId, userId);

      try {
        await this.userRepository.removeCoins(userId, COINS_CONFIG.DELETE_POST);
        await this.transactionService.addStandardSpending(
          userId,
          "post",
          postId,
          "Suppression d'un post",
          COINS_CONFIG.DELETE_POST,
        );
      } catch (err) {
        console.error("Error removing coins:", err);
      }

      return ResponseHelper.success({
        message: "Post deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getPostById(postId: ObjectId): Promise<Response> {
    try {
      const post = await this.postRepository.getPostById(postId);

      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      // Populate userId with public user fields using generic helper
      try {
        await populateReferences([post], this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate user for post:", err);
      }

      // Populate community field
      try {
        await populateReferences(
          [post],
          this.communityRepository,
          "community",
          "community",
          [
            "_id",
            "name",
            "banner",
            "privacy",
            "membersCount",
            "description",
            "icon",
          ],
          false,
        );
      } catch (err) {
        console.error("Failed to populate community for posts:", err);
      }

      if (post.ownerType === "company" && post.ownerId) {
        try {
          const company = await this.companyRepository.getCompanyById(
            post.ownerId,
          );
          if (company && company._id) {
            post.ownerData = {
              _id: company._id,
              name: company.name || "",
              logo: company.logo || "",
              userId: company.userId,
            };
          }
        } catch (err) {
          console.error("Failed to populate company data for post:", err);
        }
      }

      await this.postRepository.incrementViews(postId);
      return ResponseHelper.success(post);
    } catch (err) {
      console.error("Error getting post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getPostsByUserId(userId: ObjectId): Promise<Response> {
    try {
      const posts = await this.postRepository.getPostsByUserId(userId);
      await populateReferences(posts, this.userRepository, "userId");
      return ResponseHelper.success(posts);
    } catch (err) {
      console.error("Error getting posts by user:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getFeed(
    userId: ObjectId,
    page: number,
    limit: number,
    filter: string = "following",
  ): Promise<Response> {
    try {
      let posts: Post[] = [];
      let total = 0;

      if (filter === "following") {
        posts = await this.postRepository.getFeedPosts(userId, page, limit);
        total = await this.postRepository.countFeedPosts(userId);
      } else if (filter === "popular") {
        posts = await this.postRepository.getTrendingPosts(limit);
        total = posts.length;
      } else if (filter === "saved") {
        posts = await this.postRepository.getSavedPosts(userId, page, limit);
        total = await this.postRepository.countSavedPosts(userId);
      } else if (filter === "new") {
        posts = await this.postRepository.getNewPosts(page, limit);
        total = await this.postRepository.getAllPostsCount();
      } else {
        posts = await this.postRepository.getAllPosts(page, limit);
        total = await this.postRepository.getAllPostsCount();
      }

      for (const post of posts) {
        if (!post.ownerType) {
          post.ownerType = "user";
        }
        if (!post.ownerId && post.userId) {
          if (post.userId instanceof ObjectId) {
            post.ownerId = post.userId;
          } else if (typeof post.userId === "object" && post.userId._id) {
            post.ownerId = post.userId._id;
          } else if (typeof post.userId === "string") {
            post.ownerId = new ObjectId(post.userId);
          }
        }
      }

      const enrichedPosts = await this.enrichPosts(posts, userId);

      return ResponseHelper.success({
        data: enrichedPosts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Error in getFeed:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  private async enrichPosts(
    posts: Post[],
    currentUserId: ObjectId,
  ): Promise<Post[]> {
    const enriched: Post[] = [];

    for (const post of posts) {
      let ownerData = undefined;
      let finalOwnerType = post.ownerType;
      let finalOwnerId = post.ownerId;

      if (!finalOwnerType) {
        finalOwnerType = "user";
        if (post.userId) {
          if (post.userId instanceof ObjectId) {
            finalOwnerId = post.userId;
          } else if (typeof post.userId === "object" && post.userId._id) {
            finalOwnerId = post.userId._id;
          } else if (typeof post.userId === "string") {
            finalOwnerId = new ObjectId(post.userId);
          }
        }
      }

      if (finalOwnerType === "user" && finalOwnerId) {
        const ownerIdObj =
          finalOwnerId instanceof ObjectId
            ? finalOwnerId
            : new ObjectId(finalOwnerId);
        const user = await this.userRepository.findById(ownerIdObj, 0);
        if (user) {
          ownerData = {
            _id: user._id,
            name:
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.userName ||
              "Utilisateur",
            logo: user.image || "",
            userId: user._id,
          };
        }
      } else if (finalOwnerType === "company" && finalOwnerId) {
        const ownerIdObj =
          finalOwnerId instanceof ObjectId
            ? finalOwnerId
            : new ObjectId(finalOwnerId);
        const company = await this.companyRepository.getCompanyById(ownerIdObj);
        if (company) {
          ownerData = {
            _id: company._id,
            name: company.name || "Entreprise",
            logo: company.logo || "",
            userId: company.userId,
          };
        }
      }

      const userVote = post.userVotes?.find(
        (v) => v.userId.toString() === currentUserId.toString(),
      );

      // Créer l'objet post enrichi
      const enrichedPost: Post = {
        ...post,
        ownerType: finalOwnerType,
        ownerId: finalOwnerId,
        ownerData: ownerData,
      };

      // Ajouter les propriétés supplémentaires directement sur l'objet
      (
        enrichedPost as { userVote?: string | null; isSaved?: boolean }
      ).userVote = userVote?.vote || null;
      (
        enrichedPost as { userVote?: string | null; isSaved?: boolean }
      ).isSaved =
        post.savedBy?.some(
          (id) => id.toString() === currentUserId.toString(),
        ) || false;

      enriched.push(enrichedPost);
    }

    return enriched;
  }
  async getPostsByCommunity(
    communityId: ObjectId,
    page: number = 1,
    limit: number = 10,
    sort: "recent" | "popular" | "trending" = "recent",
  ): Promise<Response> {
    try {
      let posts: Post[] = [];

      // Get posts from repository
      posts = await this.postRepository.getPostsByCommunity(communityId);

      // Apply pagination manually since the repository method doesn't support it
      const skip = (page - 1) * limit;
      const paginatedPosts = posts.slice(skip, skip + limit);

      // Apply sorting
      if (sort === "recent") {
        paginatedPosts.sort(
          (a, b) =>
            new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
        );
      } else if (sort === "popular") {
        paginatedPosts.sort((a, b) => (b.votes || 0) - (a.votes || 0));
      } else if (sort === "trending") {
        paginatedPosts.sort(
          (a, b) => (b.trendingScore || 0) - (a.trendingScore || 0),
        );
      }

      // Populate user information
      try {
        await populateReferences(paginatedPosts, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for community posts:", err);
      }

      return ResponseHelper.success({
        posts: paginatedPosts,
        page,
        limit,
        total: posts.length,
        hasMore: skip + limit < posts.length,
      });
    } catch (err) {
      console.error("Error getting posts by community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async votePost(
    userId: ObjectId,
    postId: ObjectId,
    vote: "up" | "down" | null,
  ): Promise<Response> {
    try {
      const post = await this.postRepository.getPostById(postId);

      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      const existingVote = post.userVotes?.find((v) => v.userId.equals(userId));

      // Handle vote removal (when vote is null)
      if (vote === null) {
        if (existingVote) {
          await this.collection.updateOne(
            { _id: postId },
            { $pull: { userVotes: { userId: userId } } },
          );
        }

        const updatedPost = await this.postRepository.getPostById(postId);
        if (updatedPost) {
          updatedPost.trendingScore = this.calculateTrendingScore(updatedPost);
          await this.postRepository.updatePost(updatedPost);
        }

        return ResponseHelper.success({
          message: "Vote removed",
          totalVotes: post.votes || 0,
        });
      }

      if (existingVote) {
        await this.collection.updateOne(
          { _id: postId, "userVotes.userId": userId },
          { $set: { "userVotes.$.vote": vote } },
        );
      } else {
        await this.collection.updateOne(
          { _id: postId },
          {
            $push: {
              userVotes: {
                userId,
                vote,
                createdAt: new Date(),
              },
            },
            $inc: { votes: 1 },
          },
        );
        const targetUserId =
          post.userId instanceof ObjectId ? post.userId : post.userId._id;

        if (!targetUserId) {
          throw new Error("Invalid post.userId: missing _id");
        }
        if (vote === "up" && !userId.equals(targetUserId)) {
          try {
            await this.notificationHandler.handleNewLike(
              userId,
              postId,
              targetUserId,
              "post",
            );
          } catch (err) {
            console.error("Error sending like notification:", err);
          }
        }
      }

      const updatedPost = await this.postRepository.getPostById(postId);
      if (updatedPost) {
        updatedPost.trendingScore = this.calculateTrendingScore(updatedPost);
        await this.postRepository.updatePost(updatedPost);
      }

      return ResponseHelper.success({
        message: "Vote recorded",
        totalVotes: updatedPost?.votes || 0,
      });
    } catch (err) {
      console.error("Error voting post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async commentPost(
    userId: ObjectId,
    postId: ObjectId,
    content: string,
    parentCommentId?: ObjectId,
    requestedOwnerType?: "user" | "company",
    requestedOwnerId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!content.trim()) {
        return ResponseHelper.error("Comment content is required");
      }

      const post = await this.postRepository.getPostById(postId);
      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      let finalOwnerType: "user" | "company" = "user";
      let finalOwnerId: ObjectId = userId;

      if (requestedOwnerType === "company" && requestedOwnerId) {
        const company =
          await this.companyRepository.getCompanyById(requestedOwnerId);
        if (company && company.userId.equals(userId)) {
          finalOwnerType = "company";
          finalOwnerId = requestedOwnerId;
        }
      }

      const comment: Comment = {
        postId,
        userId,
        content,
        parentCommentId: parentCommentId || null,
        repliesCount: 0,
        votes: 0,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerType: finalOwnerType,
        ownerId: finalOwnerId,
      };

      const savedComment = await this.commentRepository.createComment(comment);

      if (parentCommentId) {
        await this.commentRepository.incrementReplies(parentCommentId);
      }

      const lastComment = {
        id: savedComment._id!,
        userId: savedComment.userId,
        content: savedComment.content.substring(0, 100),
        createdAt: savedComment.createdAt || new Date(),
      };

      await this.collection.updateOne(
        { _id: postId },
        {
          $inc: { commentsCount: 1 },
          $set: {
            lastActivityAt: new Date(),
            lastComment,
          },
        },
      );

      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_COMMENT);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.ADD_COMMENT,
          "comment",
          savedComment._id!,
          "Commentaire sur un post",
          {
            postId: postId.toString(),
            content: content.substring(0, 50),
          },
        );
      } catch (err) {
        console.error("Error adding coins for comment:", err);
      }

      const targetUserId =
        post.userId instanceof ObjectId ? post.userId : post.userId._id;

      if (!targetUserId) {
        throw new Error("Invalid post.userId: missing _id");
      }

      if (!userId.equals(targetUserId)) {
        try {
          const commentPreview =
            content.length > 100 ? content.substring(0, 100) + "..." : content;
          await this.notificationHandler.handleNewComment(
            userId,
            postId,
            targetUserId,
            savedComment._id!,
            commentPreview,
          );
        } catch (err) {
          console.error("Error sending comment notification:", err);
        }
      }

      return ResponseHelper.success({
        message: "Comment added",
        comment: savedComment,
      });
    } catch (err) {
      console.error("Error commenting post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getPostComments(
    postId: ObjectId,
    page: number = 1,
    limit: number = 10,
    sort: "recent" | "popular" = "recent",
  ): Promise<Response> {
    try {
      const comments = await this.commentRepository.getCommentsByPostId(
        postId,
        page,
        limit,
        sort,
      );

      try {
        await populateReferences(comments, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for comments:", err);
      }

      for (const comment of comments) {
        if (comment.ownerType === "company" && comment.ownerId) {
          try {
            const company = await this.companyRepository.getCompanyById(
              comment.ownerId,
            );
            if (company && company._id) {
              comment.ownerData = {
                _id: company._id,
                name: company.name || "",
                logo: company.logo || "",
                userId: company.userId
                  ? company.userId instanceof ObjectId
                    ? company.userId.toString()
                    : company.userId
                  : "",
              };
            }
          } catch (err) {
            console.error("Failed to populate company data for comment:", err);
          }
        }
      }

      const total = await this.commentRepository.getCommentsCount(postId);

      return ResponseHelper.success({
        comments,
        page,
        limit,
        total,
        hasMore: page * limit < total,
      });
    } catch (err) {
      console.error("Error getting comments:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCommentReplies(
    commentId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Response> {
    try {
      const replies = await this.commentRepository.getReplies(
        commentId,
        page,
        limit,
      );

      try {
        await populateReferences(replies, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for replies:", err);
      }

      for (const reply of replies) {
        if (reply.ownerType === "company" && reply.ownerId) {
          try {
            const ownerIdObj =
              reply.ownerId instanceof ObjectId
                ? reply.ownerId
                : new ObjectId(String(reply.ownerId));

            const company =
              await this.companyRepository.getCompanyById(ownerIdObj);
            if (company && company._id) {
              reply.ownerData = {
                _id: company._id,
                name: company.name || "",
                logo: company.logo || "",
                userId: company.userId
                  ? company.userId instanceof ObjectId
                    ? company.userId.toString()
                    : company.userId
                  : "",
              };
            }
          } catch (err) {
            console.error("Failed to populate company data for reply:", err);
          }
        }
      }

      return ResponseHelper.success({
        replies,
        page,
        limit,
        total: replies.length,
      });
    } catch (err) {
      console.error("Error getting replies:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async voteComment(
    userId: ObjectId,
    commentId: ObjectId,
    vote: "up" | "down",
  ): Promise<Response> {
    try {
      const success = await this.commentRepository.voteComment(
        commentId,
        userId,
        vote,
      );

      if (!success) {
        return ResponseHelper.error("Comment not found");
      }

      return ResponseHelper.success({
        message: "Vote recorded",
      });
    } catch (err) {
      console.error("Error voting comment:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateComment(
    userId: ObjectId,
    commentId: ObjectId,
    content: string,
  ): Promise<Response> {
    try {
      const comment = await this.commentRepository.getCommentById(commentId);
      if (!comment) {
        return ResponseHelper.error("Comment not found");
      }

      if (!comment.userId.equals(userId)) {
        return ResponseHelper.error("Access denied");
      }

      const success = await this.commentRepository.updateComment(
        commentId,
        content,
      );

      if (!success) {
        return ResponseHelper.error("Failed to update comment");
      }

      return ResponseHelper.success({
        message: "Comment updated",
      });
    } catch (err) {
      console.error("Error updating comment:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteComment(
    userId: ObjectId,
    commentId: ObjectId,
  ): Promise<Response> {
    try {
      const comment = await this.commentRepository.getCommentById(commentId);
      if (!comment) {
        return ResponseHelper.error("Comment not found");
      }

      if (!comment.userId.equals(userId)) {
        return ResponseHelper.error("Access denied");
      }

      const success = await this.commentRepository.deleteComment(
        commentId,
        userId,
      );

      if (!success) {
        return ResponseHelper.error("Failed to delete comment");
      }

      await this.collection.updateOne(
        { _id: comment.postId },
        { $inc: { commentsCount: -1 } },
      );

      return ResponseHelper.success({
        message: "Comment deleted",
      });
    } catch (err) {
      console.error("Error deleting comment:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async savePost(userId: ObjectId, postId: ObjectId): Promise<Response> {
    try {
      await this.postRepository.addToSaved(userId, postId);
      return ResponseHelper.success({ message: "Post saved" });
    } catch (err) {
      console.error("Error saving post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async unsavePost(userId: ObjectId, postId: ObjectId): Promise<Response> {
    try {
      await this.postRepository.removeFromSaved(userId, postId);
      return ResponseHelper.success({ message: "Post unsaved" });
    } catch (err) {
      console.error("Error unsaving post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getTrendingPosts(limit: number = 10): Promise<Response> {
    try {
      const posts = await this.postRepository.getTrendingPosts(limit);
      return ResponseHelper.success(posts);
    } catch (err) {
      console.error("Error getting trending posts:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  private async handleImagePost(
    post: Post,
    formData: FormData,
    userId: ObjectId,
  ): Promise<void> {
    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.posts}`;

    const uploadResults = (await handleFileUpload(formData, {
      fieldName: "media",
      storePath,
      fileName: `post-${Date.now()}`,
      multiple: true,
      writeToDisk: true,
      userId,
    })) as UploadResult[];

    if (uploadResults && uploadResults.length > 0) {
      /* if ("media" in post) {
        delete (post as any).images;
      } */
      post.media = uploadResults.map((result, index) => ({
        id: new ObjectId().toString(),
        type: "image" as const,
        url: result.fileName || "",
        order: index,
      }));
    }
  }

  private async handleVideoPost(
    post: Post,
    formData: FormData,
    userId: ObjectId,
  ): Promise<void> {
    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.posts}`;

    const uploadResults = (await handleFileUpload(formData, {
      fieldName: "media",
      storePath,
      fileName: `post-video-${Date.now()}`,
      multiple: true,
      writeToDisk: true,
      userId,
    })) as UploadResult[];
    if (uploadResults && uploadResults.length > 0) {
      post.media = [
        {
          id: new ObjectId().toString(),
          type: "video" as const,
          url: uploadResults[0]!.fileName! || "",
        },
      ];
    }
  }

  private async handleGalleryPost(
    post: Post,
    formData: FormData,
    userId: ObjectId,
  ): Promise<void> {
    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.posts}`;

    const uploadResults = (await handleFileUpload(formData, {
      fieldName: "media",
      storePath,
      fileName: `gallery-${Date.now()}`,
      multiple: true,
      writeToDisk: true,
      userId,
    })) as UploadResult[];

    if (uploadResults && uploadResults.length > 0) {
      post.media = uploadResults.map((result, index) => ({
        id: new ObjectId().toString(),
        type: "image" as const,
        url: result.fileName || "",
        order: index,
      }));

      /*  post.galleryConfig = {
        aspectRatio: "original",
        showArrows: true,
        showIndicators: true,
        autoPlay: false,
        transitionSpeed: 3000,
      }; */
    }
  }

  private async handlePostMedia(
    post: Post,
    formData: FormData,
    userId: ObjectId,
  ): Promise<void> {
    const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.posts}`;

    const uploadResults = (await handleFileUpload(formData, {
      fieldName: "media",
      storePath,
      fileName: `post-media-${Date.now()}`,
      multiple: true,
      writeToDisk: true,
      userId,
    })) as UploadResult[];
    if (uploadResults && uploadResults.length > 0) {
      post.media = uploadResults.map((result, index) => ({
        id: new ObjectId().toString(),
        type: result.mimeType?.startsWith("image/")
          ? "image"
          : ("video" as const),
        url: result.fileName || "",
        order: index,
      }));
    }
  }

  private calculateTrendingScore(post: Post): number {
    const now = new Date().getTime();
    const postTime = new Date(post.createdAt!).getTime();
    const hoursSincePost = (now - postTime) / (1000 * 60 * 60);

    let score = post.votes * 2;
    score += post.commentsCount * 1.5;
    score += post.shares * 3;
    score += post.views * 0.1;

    const decayFactor = Math.exp(-hoursSincePost / 24);
    score *= decayFactor;

    return Math.round(score * 100) / 100;
  }
  async sharePost(
    userId: ObjectId,
    postId: ObjectId,
    avis?: string,
  ): Promise<Response> {
    try {
      const originalPost = await this.postRepository.getPostById(postId);

      if (!originalPost) {
        return ResponseHelper.error("Post not found");
      }

      // Check if user already shared this post
      if (originalPost.sharedBy?.some((id) => id.equals(userId))) {
        return ResponseHelper.error("You have already shared this post");
      }

      // Create share post
      const sharedPost = await this.postRepository.createSharePost(
        postId,
        userId,
        avis,
      );

      // Populate user info for response
      try {
        await populateReferences([sharedPost], this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate user for shared post:", err);
      }

      return ResponseHelper.success({
        message: "Post shared successfully",
        post: sharedPost,
      });
    } catch (err) {
      console.error("Error sharing post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getSharedPosts(
    userId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Response> {
    try {
      const posts = await this.postRepository.getSharedPosts(userId);

      // Apply pagination
      const skip = (page - 1) * limit;
      const paginatedPosts = posts.slice(skip, skip + limit);

      // Populate user information
      try {
        await populateReferences(paginatedPosts, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for shared posts:", err);
      }

      return ResponseHelper.success({
        posts: paginatedPosts,
        page,
        limit,
        total: posts.length,
        hasMore: skip + limit < posts.length,
      });
    } catch (err) {
      console.error("Error getting shared posts:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getPostShares(
    postId: ObjectId,
    page: number = 1,
    limit: number = 10,
  ): Promise<Response> {
    try {
      const post = await this.postRepository.getPostById(postId);

      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      // Get all share posts referencing this original post
      const shares = await this.collection
        .find({ originalPostId: postId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // Populate user information
      try {
        await populateReferences(shares, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for shares:", err);
      }

      const total = await this.collection.countDocuments({
        originalPostId: postId,
      });

      return ResponseHelper.success({
        shares,
        page,
        limit,
        total,
        hasMore: page * limit < total,
      });
    } catch (err) {
      console.error("Error getting post shares:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
