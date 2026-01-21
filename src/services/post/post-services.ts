import { ObjectId } from "mongodb";

import { COINS_CONFIG } from "../../utils/coins-config";
import { BaseService } from "../base/base-service";
import type { Post } from "../../models/post";
import { CollectionsManager } from "../../models/base/collection-manager";
import { ResponseHelper } from "../../utils/response-helper";
import { FileService } from "../../utils/file-service";
import { UPLOAD_PATHS } from "../../config/config";
import { handleFileUpload, type UploadResult } from "../../utils/upload-helper";
import type { IPostService } from "../../interfaces/post/i-post-service";
import type { IPostRepository } from "../../interfaces/post/i-post-repository";
import type { IUserRepository } from "../../interfaces/user/i-user-repository";
import type { TransactionService } from "../transaction-services";

export class PostServices extends BaseService<Post> implements IPostService {
  constructor(
    private postRepository: IPostRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.postCollection);
  }

  async createPost(
    userId: ObjectId,
    post: Post,
    formData: FormData,
  ): Promise<Response> {
    try {
      // Validation
      if (!post.title || !post.community) {
        return ResponseHelper.error("Title and community are required");
      }

      // Initialiser le post
      post.userId = userId;
      post.votes = 0;
      post.comments = [];
      post.commentsCount = 0;
      post.views = 0;
      post.shares = 0;
      post.saves = 0;
      post.createdAt = new Date();
      post.updatedAt = new Date();
      post.lastActivityAt = new Date();

      // Gérer le type de contenu
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

      // Calculer le score de trending
      post.trendingScore = this.calculateTrendingScore(post);

      // Sauvegarder le post
      await this.postRepository.addPost(post);

      // Ajouter des coins
      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.CREATE_POST);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.CREATE_POST,
          "post",
          post._id!,
          "Création d'un post",
          {
            title: post.title,
            type: post.type,
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
        return ResponseHelper.error("Post not found or access denied");
      }

      // Mettre à jour le post
      post._id = postId;
      post.userId = userId;
      post.updatedAt = new Date();

      // Gérer les médias
      if (formData.has("media")) {
        // Supprimer les anciens fichiers
        if (existingPost.media && existingPost.media.length > 0) {
          await FileService.deleteMultipleFiles(
            existingPost.media.map((m) => m.url),
            userId.toString(),
          );
        }

        // Ajouter les nouveaux médias
        await this.handlePostMedia(post, formData, userId);
      }

      await this.postRepository.updatePost(post);

      return ResponseHelper.success(post);
    } catch (err) {
      console.error("Error updating post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deletePost(userId: ObjectId, postId: ObjectId): Promise<Response> {
    try {
      const existingPost = await this.collection.findOne({
        _id: postId,
        userId: userId,
      });

      if (!existingPost) {
        return ResponseHelper.error("Post not found or access denied");
      }

      // Supprimer les fichiers média
      if (existingPost.media && existingPost.media.length > 0) {
        await FileService.deleteMultipleFiles(
          existingPost.media.map((m) => m.url),
          userId.toString(),
        );
      }

      // Supprimer le post
      await this.postRepository.deletePost(postId, userId);

      // Retirer les coins
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

      // Incrémenter les vues
      await this.postRepository.incrementViews(postId);

      return ResponseHelper.success(post);
    } catch (err) {
      console.error("Error getting post:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFeed(
    userId: ObjectId,
    page: number = 1,
    limit: number = 10,
    filter: string = "popular",
  ): Promise<Response> {
    try {
      let posts: Post[] = [];

      switch (filter) {
        case "popular":
          posts = await this.postRepository.getTrendingPosts(limit);
          break;
        case "new":
          posts = await this.postRepository.getPostsByUserId(userId);
          break;
        case "saved":
          posts = await this.postRepository.getSavedPosts(userId);
          break;
        default:
          posts = await this.postRepository.getFeedPosts(userId, page, limit);
      }

      return ResponseHelper.success({
        posts,
        page,
        limit,
        total: posts.length,
      });
    } catch (err) {
      console.error("Error getting feed:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async votePost(
    userId: ObjectId,
    postId: ObjectId,
    vote: "up" | "down",
  ): Promise<Response> {
    try {
      const post = await this.postRepository.getPostById(postId);

      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      // Vérifier si l'utilisateur a déjà voté
      const existingVote = post.userVotes?.find((v) => v.userId.equals(userId));
      const voteValue = vote === "up" ? 1 : -1;

      if (existingVote) {
        // Retirer le vote existant
        const oldVoteValue = existingVote.vote === "up" ? 1 : -1;
        await this.postRepository.incrementVotes(postId, -oldVoteValue);

        // Si le nouveau vote est le même, annuler
        if (existingVote.vote === vote) {
          // Supprimer le vote
          await this.collection.updateOne(
            { _id: postId },
            { $pull: { userVotes: { userId: userId } } },
          );
        } else {
          // Changer le vote
          await this.collection.updateOne(
            { _id: postId, "userVotes.userId": userId },
            { $set: { "userVotes.$.vote": vote } },
          );
          await this.postRepository.incrementVotes(postId, voteValue);
        }
      } else {
        // Ajouter un nouveau vote
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
          },
        );
        await this.postRepository.incrementVotes(postId, voteValue);
      }

      // Mettre à jour le score de trending
      const updatedPost = await this.postRepository.getPostById(postId);
      if (updatedPost) {
        updatedPost.trendingScore = this.calculateTrendingScore(updatedPost);
        await this.postRepository.updatePost(updatedPost);
      }

      return ResponseHelper.success({
        message: "Vote recorded",
        totalVotes: (post.votes || 0) + (existingVote ? 0 : voteValue),
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
  ): Promise<Response> {
    try {
      if (!content.trim()) {
        return ResponseHelper.error("Comment content is required");
      }

      const post = await this.postRepository.getPostById(postId);

      if (!post) {
        return ResponseHelper.error("Post not found");
      }

      // Créer le commentaire
      const comment = {
        id: new ObjectId().toString(),
        userId,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        votes: 0,
      };

      // Ajouter le commentaire
      await this.collection.updateOne(
        { _id: postId },
        {
          $push: { comments: comment },
          $inc: { commentsCount: 1 },
          $set: { lastActivityAt: new Date() },
        },
      );

      // Ajouter des coins pour le commentaire
      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_COMMENT);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.ADD_COMMENT,
          "comment",
          new ObjectId(comment.id),
          "Commentaire sur un post",
          {
            postId: postId.toString(),
            content: content.substring(0, 50),
          },
        );
      } catch (err) {
        console.error("Error adding coins for comment:", err);
      }

      return ResponseHelper.success({
        message: "Comment added",
        comment,
      });
    } catch (err) {
      console.error("Error commenting post:", err);
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
      fieldName: "images",
      storePath,
      fileName: `post-${Date.now()}`,
      multiple: true,
      writeToDisk: true,
      userId,
    })) as UploadResult[];

    if (uploadResults && uploadResults.length > 0) {
      if ("images" in post) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (post as any).images;
      }
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
      fieldName: "video",
      storePath,
      fileName: `post-video-${Date.now()}`,
      multiple: false,
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
      fieldName: "gallery",
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

      // Configuration par défaut de la galerie
      post.galleryConfig = {
        aspectRatio: "original",
        showArrows: true,
        showIndicators: true,
        autoPlay: false,
        transitionSpeed: 3000,
      };
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
        type: result.fileType?.includes("image") ? "image" : ("video" as const),
        url: result.fileName || "",
        order: index,
      }));
    }
  }

  private calculateTrendingScore(post: Post): number {
    const now = new Date().getTime();
    const postTime = new Date(post.createdAt!).getTime();
    const hoursSincePost = (now - postTime) / (1000 * 60 * 60);

    // Formule de trending : votes récents + commentaires + partages
    let score = post.votes * 2;
    score += post.commentsCount * 1.5;
    score += post.shares * 3;
    score += post.views * 0.1;

    // Décroissance temporelle
    const decayFactor = Math.exp(-hoursSincePost / 24);
    score *= decayFactor;

    return Math.round(score * 100) / 100;
  }
}
