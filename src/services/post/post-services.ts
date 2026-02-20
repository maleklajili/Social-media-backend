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

export class PostServices extends BaseService<Post> implements IPostService {
  private commentRepository: ICommentRepository;

  constructor(
    private postRepository: IPostRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,
    commentRepository?: ICommentRepository,
  ) {
    super(CollectionsManager.postCollection);
    this.commentRepository = commentRepository || new CommentRepository();
  }
  async getAllPosts(page: number = 1, limit: number = 10): Promise<Post[]> {
    const skip = (page - 1) * limit;

    return await this.collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  async createPost(
    userId: ObjectId,
    post: Post,
    formData: FormData,
  ): Promise<Response> {
    try {
      if (!post.title) {
        return ResponseHelper.error("Title is required");
      }
      const privacyValue = formData.get("privacy") as string;

      if (
        privacyValue &&
        ["public", "friends", "private"].includes(privacyValue)
      ) {
        post.privacy = privacyValue as "public" | "friends" | "private";
      } else {
        post.privacy = "friends"; // Valeur par défaut
      }
      post.userId = userId;
      post.votes = 0;
      post.commentsCount = 0;
      post.views = 0;
      post.shares = 0;
      post.saves = 0;
      post.createdAt = new Date();
      post.updatedAt = new Date();
      post.lastActivityAt = new Date();

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
      await this.postRepository.addPost(post);

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

  async deletePost(userId: ObjectId, postId: ObjectId): Promise<Response> {
    try {
      const existingPost = await this.collection.findOne({
        _id: postId,
        userId: userId,
      });

      if (!existingPost) {
        return ResponseHelper.error("Post not found or access denied");
      }

      if (existingPost.media && existingPost.media.length > 0) {
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
        case "all":
          posts = await this.postRepository.getAllPosts(page, limit);
          break;
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

      // Populate userId with public user fields using generic helper
      try {
        await populateReferences(posts, this.userRepository, "userId");
      } catch (err) {
        console.error("Failed to populate users for posts:", err);
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
          // Just remove the vote from userVotes, don't adjust votes count
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

      // Handle voting (up or down)
      if (existingVote) {
        // User is changing their vote (up → down or down → up)
        // Just update the vote type, don't change the votes count
        await this.collection.updateOne(
          { _id: postId, "userVotes.userId": userId },
          { $set: { "userVotes.$.vote": vote } },
        );
      } else {
        // New vote - increment the votes counter
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
            $inc: { votes: 1 }, // Only increment for new votes
          },
        );
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
  ): Promise<Response> {
    try {
      if (!content.trim()) {
        return ResponseHelper.error("Comment content is required");
      }

      const post = await this.postRepository.getPostById(postId);
      if (!post) {
        return ResponseHelper.error("Post not found");
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
}
