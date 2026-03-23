import { ObjectId } from "mongodb";
import { UPLOAD_PATHS } from "../config/config";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { ChangePasswordPayload } from "../interfaces/base/i-crud-controller";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { IUserService } from "../interfaces/user/i-user-service";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";

import { CollectionsManager } from "../models/base/collection-manager";
import type { User } from "../models/user";
import type { ProfessionalUser } from "../models/user/professional-user";
import { ResponseHelper } from "../utils/response-helper";

import {
  deleteFiles,
  handleFileUpload,
  type UploadResult,
} from "../utils/upload-helper";
import { BaseService } from "./base/base-service";
import type { Company } from "../models/company";

export class UserService extends BaseService<User> implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private companyRepository: ICompanyRepository,
  ) {
    super(CollectionsManager.userCollection);
  }

  async findUserById(userId: ObjectId | undefined): Promise<Response> {
    if (!userId || !ObjectId.isValid(userId)) {
      return ResponseHelper.error("Invalid user ID format", 400);
    }
    const user = await this.userRepository.findById(userId, 0);
    return ResponseHelper.success(user);
  }

  async changePassword(
    userId: ObjectId | undefined,
    body: ChangePasswordPayload,
  ): Promise<Response> {
    if (!userId) {
      return ResponseHelper.error("User ID is required");
    }

    const user = await this.userRepository.findById(userId, 1);
    if (!user) {
      return ResponseHelper.error("User not found");
    }

    const isOldPasswordCorrect = await Bun.password.verify(
      body.oldPassword,
      user.password,
    );
    if (!isOldPasswordCorrect) {
      return ResponseHelper.error("Old password is incorrect");
    }

    const isSameAsOld = await Bun.password.verify(
      body.newPassword,
      user.password,
    );
    if (isSameAsOld) {
      return ResponseHelper.error(
        "New password must be different from the old password",
      );
    }

    const hashPassword = await Bun.password.hash(body.newPassword);
    await this.userRepository.changePassword(userId, hashPassword);

    return ResponseHelper.success("Password changed successfully");
  }

  async updateProfile(
    req: ServerRequest,
    user: User,
    formData: FormData,
  ): Promise<Response> {
    const userId = req.user?._id;
    const imageStorePath = `${UPLOAD_PATHS.images}-${userId}`;
    const docStorePath = `${UPLOAD_PATHS.documents}-${userId}`; // path for CV

    if (user.userName) {
      const existingUser = await this.userRepository.findByUsername(
        user.userName,
      );
      if (existingUser && existingUser._id?.toString() !== userId?.toString()) {
        return ResponseHelper.error("Username already exists", 400);
      }
    }
    if (user.email) {
      const existingUser = await this.userRepository.findByEmail(user.email);
      if (existingUser && existingUser._id?.toString() !== userId?.toString()) {
        return ResponseHelper.error("email already exists", 400);
      }
    }

    const currentUser = await this.userRepository.findById(userId, 0);
    if (!currentUser) {
      return ResponseHelper.error("User not found", 404);
    }

    // Handle profile image update
    if (formData.has("image")) {
      const result = (await handleFileUpload(formData, {
        fieldName: "image",
        storePath: imageStorePath,
        fileName: new Date().getTime().toString(),
        multiple: false,
        writeToDisk: true,
        userId: userId,
      })) as UploadResult;

      if (result?.fileName) {
        if (currentUser.image) {
          deleteFiles(currentUser.image, imageStorePath, currentUser._id);
        }
        user.image = result.fileName;
      } else {
        if (currentUser.image) {
          deleteFiles(currentUser.image, imageStorePath, currentUser._id);
        }
        user.image = "";
      }
    }

    // Handle cover image update
    if (formData.has("cover")) {
      const result = (await handleFileUpload(formData, {
        fieldName: "cover",
        storePath: imageStorePath,
        fileName: new Date().getTime().toString() + "_cover",
        multiple: false,
        writeToDisk: true,
        userId: userId,
      })) as UploadResult;

      if (result?.fileName) {
        if (currentUser.cover) {
          deleteFiles(currentUser.cover, imageStorePath, currentUser._id);
        }
        user.cover = result.fileName;
      } else {
        if (currentUser.cover) {
          deleteFiles(currentUser.cover, imageStorePath, currentUser._id);
        }
        user.cover = "";
      }
    }

    if (formData.has("cv")) {
      const cvFile = formData.get("cv") as File;
      if (cvFile && cvFile instanceof File) {
        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        if (!allowedTypes.includes(cvFile.type)) {
          return ResponseHelper.error(
            "Type de fichier non autorisé. Seuls PDF, DOC et DOCX sont acceptés.",
            400,
          );
        }
        // Limite de taille : 5 Mo
        if (cvFile.size > 5 * 1024 * 1024) {
          return ResponseHelper.error(
            "Le fichier ne doit pas dépasser 5 Mo.",
            400,
          );
        }
      }

      const result = (await handleFileUpload(formData, {
        fieldName: "cv",
        storePath: docStorePath,
        fileName: `cv_${new Date().getTime()}`,
        multiple: false,
        writeToDisk: true,
        userId: userId,
      })) as UploadResult;

      // On caste currentUser et user en ProfessionalUser pour accéder à cv
      const professionalCurrent = currentUser as ProfessionalUser;
      const professionalUser = user as ProfessionalUser;

      if (result?.fileName) {
        if (professionalCurrent.cv) {
          deleteFiles(professionalCurrent.cv, docStorePath, currentUser._id);
        }
        professionalUser.cv = result.fileName;
      } else {
        if (professionalCurrent.cv) {
          deleteFiles(professionalCurrent.cv, docStorePath, currentUser._id);
        }
        professionalUser.cv = "";
      }
    }

    // Mise à jour du profil en base
    const updatedUser = await this.userRepository.updateProfile(userId, user);
    return ResponseHelper.success(updatedUser);
  }

  async followUser(
    currentUserId: ObjectId,
    targetUserId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(targetUserId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      const targetId = new ObjectId(targetUserId);

      // Can't follow yourself
      if (currentUserId.toString() === targetId.toString()) {
        return ResponseHelper.error("You cannot follow yourself", 400);
      }

      // Check if target user exists
      const targetUser = await this.userRepository.findById(targetId, 0);
      if (!targetUser) {
        return ResponseHelper.error("User not found", 404);
      }

      // Check if already following
      const isAlreadyFollowing = await this.userRepository.isFollowing(
        currentUserId,
        targetId,
      );
      if (isAlreadyFollowing) {
        return ResponseHelper.error("You are already following this user", 400);
      }

      // Perform follow
      await this.userRepository.followUser(currentUserId, targetId);

      // Get updated counts
      const counts = await this.userRepository.getFollowCounts(targetId);

      return ResponseHelper.success({
        message: "User followed successfully",
        following: true,
        followerCount: counts.followers,
        followingCount: counts.following,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async unfollowUser(
    currentUserId: ObjectId,
    targetUserId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(targetUserId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      const targetId = new ObjectId(targetUserId);

      // Check if target user exists
      const targetUser = await this.userRepository.findById(targetId, 0);
      if (!targetUser) {
        return ResponseHelper.error("User not found", 404);
      }

      // Check if actually following
      const isFollowing = await this.userRepository.isFollowing(
        currentUserId,
        targetId,
      );
      if (!isFollowing) {
        return ResponseHelper.error("You are not following this user", 400);
      }

      // Perform unfollow
      await this.userRepository.unfollowUser(currentUserId, targetId);

      // Get updated counts
      const counts = await this.userRepository.getFollowCounts(targetId);

      return ResponseHelper.success({
        message: "User unfollowed successfully",
        following: false,
        followerCount: counts.followers,
        followingCount: counts.following,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFollowers(
    userId: string,
    currentUserId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      const targetId = new ObjectId(userId);

      // Get followers
      const followers = await this.userRepository.getFollowers(targetId);

      // If current user is provided, check follow status for each follower
      if (currentUserId) {
        const followersWithStatus = await Promise.all(
          followers.map(async (follower) => {
            const isFollowing = await this.userRepository.isFollowing(
              currentUserId,
              follower._id as ObjectId,
            );
            return {
              ...follower,
              isFollowedByCurrentUser: isFollowing,
            };
          }),
        );

        return ResponseHelper.success(followersWithStatus);
      }

      return ResponseHelper.success(followers);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFollowing(
    userId: string,
    currentUserId?: ObjectId,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      const targetId = new ObjectId(userId);

      const followedUsers = await this.userRepository.getFollowing(targetId);

      const followedCompanyIds =
        await this.userRepository.getFollowedCompanies(targetId);

      let followedCompanies: Company[] = [];
      if (followedCompanyIds.length > 0) {
        followedCompanies =
          await this.companyRepository.findCompaniesByIds(followedCompanyIds);
      }

      if (currentUserId) {
        const enhancedUsers = await Promise.all(
          followedUsers.map(async (user) => ({
            ...user,
            isFollowedByCurrentUser: await this.userRepository.isFollowing(
              currentUserId,
              user._id as ObjectId,
            ),
          })),
        );

        const enhancedCompanies = followedCompanies.map((company) => ({
          ...company,
          isFollowedByCurrentUser: true,
        }));

        return ResponseHelper.success({
          users: enhancedUsers,
          companies: enhancedCompanies,
        });
      }

      return ResponseHelper.success({
        users: followedUsers,
        companies: followedCompanies,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFollowStatus(
    currentUserId: ObjectId,
    targetUserId: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(targetUserId)) {
        return ResponseHelper.error("Invalid user ID format", 400);
      }

      const targetId = new ObjectId(targetUserId);

      const isFollowing = await this.userRepository.isFollowing(
        currentUserId,
        targetId,
      );
      const counts = await this.userRepository.getFollowCounts(targetId);

      return ResponseHelper.success({
        isFollowing,
        followerCount: counts.followers,
        followingCount: counts.following,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFriends(currentUserId: ObjectId): Promise<Response> {
    try {
      // Get mutual friends (users who follow each other)
      const mutualFriends =
        await this.userRepository.getMutualFriends(currentUserId);

      // Enhance with follow status and additional info
      const enhancedFriends = await Promise.all(
        mutualFriends.map(async (friend) => {
          // Check if current user is following this friend (should be true for mutual)
          const isFollowing = await this.userRepository.isFollowing(
            currentUserId,
            friend._id as ObjectId,
          );

          // Check if friend is following current user (should be true for mutual)
          const isFollowedBy = await this.userRepository.isFollowing(
            friend._id as ObjectId,
            currentUserId,
          );

          // Get mutual friends count
          const mutualCount = await this.getMutualFriendsCount(
            currentUserId,
            friend._id as ObjectId,
          );

          return {
            ...friend,
            isFollowing,
            isFollowedBy,
            isMutual: true,
            mutualFriendsCount: mutualCount,
            //friendshipDate: friend.friendSince || new Date().toISOString()
          };
        }),
      );

      // Sort by name or friendship date
      enhancedFriends.sort((a, b) =>
        (a.firstName || "").localeCompare(b.firstName || ""),
      );

      return ResponseHelper.success({
        total: enhancedFriends.length,
        friends: enhancedFriends,
      });
    } catch (err) {
      console.error("Error in getFriends:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getFriendSuggestions(
    currentUserId: ObjectId,
    skip: number = 0,
    limit: number = 10,
    search: string = "",
  ): Promise<{ data: User[]; total: number }> {
    try {
      // Récupérer les suggestions paginées
      const suggestions = await this.userRepository.getFriendSuggestions(
        currentUserId,
        skip,
        limit,
        search,
      );

      // Obtenir le nombre total (sans pagination)
      const total = await this.userRepository.countFriendSuggestions(
        currentUserId,
        search,
      );

      // Enrichir avec les infos supplémentaires
      const enhanced = await Promise.all(
        suggestions.map(async (suggestion) => {
          const isFollowing = await this.userRepository.isFollowing(
            currentUserId,
            suggestion._id as ObjectId,
          );
          const mutualFriendsCount = await this.getMutualFriendsCount(
            currentUserId,
            suggestion._id as ObjectId,
          );
          return {
            ...suggestion,
            isFollowing,
            isFollowedBy: false,
            mutualFriendsCount,
            suggestionReason:
              mutualFriendsCount > 0
                ? `${mutualFriendsCount} ami${mutualFriendsCount > 1 ? "s" : ""} en commun`
                : "Basé sur votre réseau",
          };
        }),
      );

      return { data: enhanced, total };
    } catch (err) {
      console.error("Error in getFriendSuggestions:", err);
      throw err;
    }
  }

  async getMutualFriendsList(
    currentUserId: ObjectId,
    targetUserId: ObjectId,
  ): Promise<Response> {
    try {
      const mutualFriends = await this.userRepository.getMutualFriendsList(
        currentUserId,
        targetUserId,
      );
      return ResponseHelper.success(mutualFriends);
    } catch (err) {
      console.error("Error in getMutualFriendsList:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async searchFriends(
    currentUserId: ObjectId,
    query: string,
  ): Promise<Response> {
    try {
      if (!query || query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
          400,
        );
      }

      // Search for users matching the query
      const searchResults = await this.userRepository.searchUsers(
        query,
        currentUserId,
        20,
      );

      // Get mutual friends for each result
      const enhancedResults = await Promise.all(
        searchResults.map(async (user) => {
          const isFollowing = await this.userRepository.isFollowing(
            currentUserId,
            user._id as ObjectId,
          );

          const isFollowedBy = await this.userRepository.isFollowing(
            user._id as ObjectId,
            currentUserId,
          );

          const mutualFriendsCount = await this.getMutualFriendsCount(
            currentUserId,
            user._id as ObjectId,
          );

          return {
            ...user,
            isFollowing,
            isFollowedBy,
            isMutual: isFollowing && isFollowedBy,
            mutualFriendsCount,
            matchScore: this.calculateMatchScore(user, query),
          };
        }),
      );

      // Sort by match score and mutual friends
      enhancedResults.sort((a, b) => {
        if (a.isMutual && !b.isMutual) return -1;
        if (!a.isMutual && b.isMutual) return 1;
        return (b.mutualFriendsCount || 0) - (a.mutualFriendsCount || 0);
      });

      return ResponseHelper.success({
        query,
        total: enhancedResults.length,
        results: enhancedResults,
      });
    } catch (err) {
      console.error("Error in searchFriends:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // Helper method to count mutual friends between two users
  private async getMutualFriendsCount(
    userId1: ObjectId,
    userId2: ObjectId,
  ): Promise<number> {
    const [user1, user2] = await Promise.all([
      this.userRepository.findById(userId1, 0),
      this.userRepository.findById(userId2, 0),
    ]);

    if (!user1 || !user2) return 0;

    const following1 = new Set(
      (user1.following || []).map((id) => id.toString()),
    );
    const following2 = new Set(
      (user2.following || []).map((id) => id.toString()),
    );

    // Count mutual following
    let mutualCount = 0;
    for (const id of following1) {
      if (
        following2.has(id) &&
        id !== userId1.toString() &&
        id !== userId2.toString()
      ) {
        mutualCount++;
      }
    }

    return mutualCount;
  }

  // Helper to calculate search relevance score
  private calculateMatchScore(user: User, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    if (user.firstName?.toLowerCase().includes(lowerQuery)) score += 10;
    if (user.lastName?.toLowerCase().includes(lowerQuery)) score += 10;
    if (user.userName?.toLowerCase().includes(lowerQuery)) score += 8;
    if (user.professionalTitle?.toLowerCase().includes(lowerQuery)) score += 5;
    if (user.location?.toLowerCase().includes(lowerQuery)) score += 3;

    // Exact matches get bonus
    if (user.firstName?.toLowerCase() === lowerQuery) score += 5;
    if (user.lastName?.toLowerCase() === lowerQuery) score += 5;
    if (user.userName?.toLowerCase() === lowerQuery) score += 5;

    return score;
  }
}
