import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Community } from "../models/community/community";
import { CollectionsManager } from "../models/base/collection-manager";
import type { ICommunityRepository } from "../interfaces/community/i-community-repository";
import type { ICommunityService } from "../interfaces/community/i-community-service";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload, type UploadResult } from "../utils/upload-helper";
import { UPLOAD_PATHS } from "../config/config";
import { FileService } from "../utils/file-service";
import type { CommunityMember } from "../models/community/community-member";

export class CommunityServices
  extends BaseService<Community>
  implements ICommunityService
{
  constructor(private communityRepository: ICommunityRepository) {
    super(CollectionsManager.communityCollection);
  }

  async createCommunity(
    userId: ObjectId,
    communityData: Partial<Community>,
    formData?: FormData,
  ): Promise<Response> {
    try {
      // Validation
      if (!communityData.name || !communityData.title) {
        return ResponseHelper.error("Community name and title are required");
      }

      // Vérifier si la communauté existe déjà
      const existingCommunity =
        await this.communityRepository.getCommunityByName(communityData.name);
      if (existingCommunity) {
        return ResponseHelper.error(
          `Community r/${communityData.name} already exists`,
        );
      }

      // Créer l'objet communauté
      const community: Community = {
        _id: new ObjectId(),
        name: communityData.name.toLowerCase(),
        title: communityData.title,
        description: communityData.description || "",
        icon: communityData.icon || "📱",
        members: 1, // Le créateur est le premier membre
        online: 0,
        createdBy: userId,
        isPublic: String(communityData.isPublic).toLowerCase() === "true",
        category: communityData.category || "general",
        tags: communityData.tags || [],
        banner: "",
      };

      // Gérer l'upload de bannière
      if (formData?.has("banner")) {
        const communityName = communityData.name.toLowerCase();
        const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.communities}/${communityName}`;

        const uploadResults = (await handleFileUpload(formData, {
          fieldName: "banner",
          storePath,
          fileName: `banner-${Date.now()}`,
          multiple: false,
          writeToDisk: true,
          userId,
        })) as UploadResult;

        if (uploadResults?.fileName) {
          community.banner = uploadResults.fileName;
        } else {
          console.log("❌ No file uploaded");
        }
      }

      if (!community._id) {
        throw new Error("Community ID is missing after creation!");
      }
      // Sauvegarder la communauté
      await this.communityRepository.createCommunity(community);
      const member: CommunityMember = {
        _id: new ObjectId(),
        communityId: community._id,
        userId,
        role: "admin",
        joinedAt: new Date(),
        isMuted: false,
        isBanned: false,
      };
      await this.communityRepository.addMember(member);
      return ResponseHelper.success({
        message: "Community created successfully",
        community,
      });
    } catch (err) {
      console.error("❌ Error creating community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateCommunity(
    userId: ObjectId,
    communityId: ObjectId,
    communityData: Partial<Community>,
    formData?: FormData,
  ): Promise<Response> {
    try {
      // Vérifier que la communauté existe
      const existingCommunity =
        await this.communityRepository.getCommunityById(communityId);
      if (!existingCommunity) {
        return ResponseHelper.error("Community not found");
      }

      // Vérifier les permissions (seuls le créateur peut modifier)
      if (!existingCommunity.createdBy.equals(userId)) {
        return ResponseHelper.error("Only the community creator can edit it");
      }

      // VÉRIFIER SI LE NOUVEAU NOM N'EST PAS DÉJÀ UTILISÉ PAR UNE AUTRE COMMUNAUTÉ
      if (communityData.name) {
        const nameAlreadyUsed =
          await this.communityRepository.getCommunityByNameExcludingId(
            communityData.name,
            communityId,
          );

        if (nameAlreadyUsed) {
          return ResponseHelper.error(
            `Community name "r/${communityData.name}" is already taken`,
          );
        }
      }

      // Mettre à jour les champs
      const updatedCommunity: Community = {
        ...existingCommunity,
        ...communityData,
        isPublic:
          communityData.isPublic !== undefined
            ? String(communityData.isPublic).toLowerCase() === "true"
            : existingCommunity.isPublic,
        updatedAt: new Date(),
      };

      // Gérer l'upload de nouvelle bannière
      if (formData?.has("banner")) {
        const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.communities}/${existingCommunity.name}`;

        // CORRECTION: Supprimer l'ancienne bannière si elle existe
        if (existingCommunity.banner) {
          // Construire le chemin complet du fichier
          const oldFilePath = `${storePath}/${existingCommunity.banner}`;
          try {
            await FileService.deleteFile(oldFilePath);
          } catch (deleteError) {
            console.warn(`⚠️ Could not delete old banner: ${deleteError}`);
            // On continue même si la suppression échoue
          }
        }

        const uploadResults = (await handleFileUpload(formData, {
          fieldName: "banner",
          storePath,
          fileName: `banner-${Date.now()}`,
          multiple: false,
          writeToDisk: true,
          userId,
        })) as UploadResult;

        if (uploadResults?.fileName) {
          updatedCommunity.banner = uploadResults.fileName;
        } else {
          // Garder l'ancienne bannière si l'upload échoue
          updatedCommunity.banner = existingCommunity.banner;
        }
      } else {
        // Si pas de nouvelle bannière, garder l'existante
        updatedCommunity.banner = existingCommunity.banner;
      }

      await this.communityRepository.updateCommunity(updatedCommunity);

      return ResponseHelper.success({
        message: "Community updated successfully",
        community: updatedCommunity,
      });
    } catch (err) {
      console.error("❌ Error updating community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteCommunity(
    userId: ObjectId,
    communityId: ObjectId,
  ): Promise<Response> {
    try {
      // Vérifier que la communauté existe
      const existingCommunity =
        await this.communityRepository.getCommunityById(communityId);
      if (!existingCommunity) {
        return ResponseHelper.error("Community not found");
      }

      // Vérifier les permissions (seuls le créateur peut supprimer)
      if (!existingCommunity.createdBy.equals(userId)) {
        return ResponseHelper.error("Only the community creator can delete it");
      }

      // Supprimer les fichiers associés (bannière)
      if (existingCommunity.banner) {
        //const storePath = `${UPLOAD_PATHS.images}/${UPLOAD_PATHS.communities}/${existingCommunity.name}`;
        await FileService.deleteFile(existingCommunity.banner);
      }

      // Supprimer la communauté
      await this.communityRepository.deleteCommunity(communityId);

      return ResponseHelper.success({
        message: "Community deleted successfully",
      });
    } catch (err) {
      console.error("❌ Error deleting community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async joinCommunity(
    userId: ObjectId,
    communityId: ObjectId,
  ): Promise<Response> {
    try {
      const community =
        await this.communityRepository.getCommunityById(communityId);
      if (!community) {
        return ResponseHelper.error("Community not found");
      }

      const existingMember = await this.communityRepository.getMember(
        communityId,
        userId,
      );
      if (existingMember) {
        return ResponseHelper.success({
          message: "You are already a member of this community",
          isMember: true,
          community,
        });
      }

      const member: CommunityMember = {
        _id: new ObjectId(),
        communityId,
        userId,
        role: "member",
        joinedAt: new Date(),
        isMuted: false,
        isBanned: false,
      };

      await this.communityRepository.addMember(member);
      await this.communityRepository.incrementMembers(communityId, 1);

      return ResponseHelper.success({
        message: "Joined community successfully",
        isMember: true,
        community,
      });
    } catch (err) {
      console.error("❌ Error joining community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async leaveCommunity(
    userId: ObjectId,
    communityId: ObjectId,
  ): Promise<Response> {
    try {
      const community =
        await this.communityRepository.getCommunityById(communityId);
      if (!community) {
        return ResponseHelper.error("Community not found");
      }

      const member = await this.communityRepository.getMember(
        communityId,
        userId,
      );
      if (!member) {
        return ResponseHelper.error("You are not a member of this community");
      }

      if (community.createdBy.equals(userId)) {
        return ResponseHelper.error(
          "Community creator cannot leave. Delete community first.",
        );
      }

      const removed = await this.communityRepository.removeMember(
        communityId,
        userId,
      );
      if (!removed) {
        return ResponseHelper.error("Failed to leave community");
      }

      await this.communityRepository.decrementMembers(communityId, 1);

      return ResponseHelper.success({
        message: "Left community successfully",
        isMember: false,
      });
    } catch (err) {
      console.error("❌ Error leaving community:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCommunityDetails(communityName: string): Promise<Response> {
    try {
      const community =
        await this.communityRepository.getCommunityByName(communityName);
      if (!community) {
        return ResponseHelper.error("Community not found");
      }

      // Formater les données pour le frontend
      const formattedCommunity = {
        ...community,
        banner: community.banner
          ? `/uploads/${UPLOAD_PATHS.communities}/${community.name}/${community.banner}`
          : null,
      };

      return ResponseHelper.success({
        community: formattedCommunity,
      });
    } catch (err) {
      console.error("❌ Error getting community details:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getPopularCommunities(limit: number = 10): Promise<Response> {
    try {
      const communities =
        await this.communityRepository.getPopularCommunities(limit);

      // Formater les données
      const formattedCommunities = communities.map((community) => ({
        ...community,
        banner: community.banner
          ? `/uploads/${UPLOAD_PATHS.communities}/${community.name}/${community.banner}`
          : null,
      }));

      return ResponseHelper.success(formattedCommunities);
    } catch (err) {
      console.error("❌ Error getting popular communities:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async searchCommunities(
    query: string,
    limit: number = 10,
  ): Promise<Response> {
    try {
      const communities = await this.communityRepository.searchCommunities(
        query,
        limit,
      );

      const formattedCommunities = communities.map((community) => ({
        ...community,
        banner: community.banner
          ? `/uploads/${UPLOAD_PATHS.communities}/${community.name}/${community.banner}`
          : null,
      }));

      return ResponseHelper.success(formattedCommunities);
    } catch (err) {
      console.error("❌ Error searching communities:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
  async getCommunityMembers(communityId: ObjectId): Promise<Response> {
    try {
      const community =
        await this.communityRepository.getCommunityById(communityId);
      if (!community) {
        return ResponseHelper.error("Community not found");
      }

      const members =
        await this.communityRepository.getCommunityMembers(communityId);
      const membersCount =
        await this.communityRepository.getCommunityMembersCount(communityId);

      return ResponseHelper.success({
        members,
        total: membersCount,
        community: {
          _id: community._id,
          name: community.name,
          title: community.title,
        },
      });
    } catch (err) {
      console.error("❌ Error getting community members:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async checkUserMembership(
    userId: ObjectId,
    communityId: ObjectId,
  ): Promise<Response> {
    try {
      const community =
        await this.communityRepository.getCommunityById(communityId);
      if (!community) {
        return ResponseHelper.error("Community not found");
      }

      const member = await this.communityRepository.getMember(
        communityId,
        userId,
      );
      const isMember = !!member;

      return ResponseHelper.success({
        isMember,
        member: isMember
          ? {
              role: member!.role,
              joinedAt: member!.joinedAt,
              isMuted: member!.isMuted,
              isBanned: member!.isBanned,
            }
          : null,
        community: {
          _id: community._id,
          name: community.name,
          title: community.title,
          members: community.members,
        },
      });
    } catch (err) {
      console.error("❌ Error checking user membership:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getUserCommunities(userId: ObjectId): Promise<Response> {
    try {
      const communities =
        await this.communityRepository.getUserCommunities(userId);

      const formattedCommunities = communities.map((community) => ({
        ...community,
        banner: community.banner
          ? `/uploads/${UPLOAD_PATHS.communities}/${community.name}/${community.banner}`
          : null,
      }));

      return ResponseHelper.success({
        communities: formattedCommunities,
        total: communities.length,
      });
    } catch (err) {
      console.error("❌ Error getting user communities:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
