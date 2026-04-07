// services/friend-group-services.ts
import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import { FriendGroupRepository } from "../repositories/friend-group-repository";
import type { FriendGroup } from "../models/friend-group";
import { ResponseHelper } from "../utils/response-helper";
import { CollectionsManager } from "../models/base/collection-manager";
import type { IFriendGroupService } from "../interfaces/friend-group/i-friend-group-service";
import { userRepository } from "../repositories/user-repository";

export class FriendGroupServices
  extends BaseService<FriendGroup>
  implements IFriendGroupService
{
  private repository: FriendGroupRepository;
  private userRepo: userRepository;

  constructor() {
    super(CollectionsManager.friendGroupCollection);
    this.repository = new FriendGroupRepository();
    this.userRepo = new userRepository();
  }

  /**
   * Crée un nouveau groupe d'amis
   */
  async createFriendGroup(
    userId: ObjectId,
    name: string,
    description?: string,
    icon?: string,
    color?: string,
  ): Promise<Response> {
    try {
      // Validation
      if (!name || name.trim().length === 0) {
        return ResponseHelper.error("Le nom du groupe est requis", 400);
      }

      if (name.length > 100) {
        return ResponseHelper.error(
          "Le nom du groupe ne doit pas dépasser 100 caractères",
          400,
        );
      }

      // Vérifier si un groupe avec ce nom existe déjà pour cet utilisateur
      const existingGroup = await this.repository.getFriendGroupByName(
        userId,
        name,
      );

      if (existingGroup && existingGroup._id) {
        return ResponseHelper.error("Un groupe avec ce nom existe déjà", 409);
      }

      const friendGroup: FriendGroup = {
        _id: new ObjectId(),
        userId,
        name: name.trim(),
        description: description?.trim() || "",
        icon: icon || "users",
        color: color || "text-blue-500",
        members: [],
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.repository.createFriendGroup(friendGroup);

      // Enrichir avec le nombre de membres
      const enrichedResult = {
        ...result,
        membersCount: 0,
      };

      return ResponseHelper.success(enrichedResult, 201);
    } catch (error) {
      console.error("Error creating friend group:", error);
      return ResponseHelper.error("Erreur lors de la création du groupe", 500);
    }
  }

  /**
   * Récupère tous les groupes d'amis d'un utilisateur
   */
  async getUserFriendGroups(userId: ObjectId): Promise<Response> {
    try {
      const groups = await this.repository.getUserFriendGroups(userId);

      // Enrichir les groupes avec le nombre de membres
      const enrichedGroups = groups.map((group) => ({
        ...group,
        membersCount: group.members?.length || 0,
      }));

      return ResponseHelper.success(enrichedGroups, 200);
    } catch (error) {
      console.error("Error fetching user friend groups:", error);
      return ResponseHelper.error(
        "Erreur lors de la récupération des groupes",
        500,
      );
    }
  }

  /**
   * Récupère un groupe d'amis spécifique
   */
  async getFriendGroupById(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden("Vous n'avez pas accès à ce groupe");
      }

      // Enrichir avec le nombre de membres
      const enrichedGroup = {
        ...group,
        membersCount: group.members?.length || 0,
      };

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error fetching friend group:", error);
      return ResponseHelper.error(
        "Erreur lors de la récupération du groupe",
        500,
      );
    }
  }

  /**
   * Met à jour un groupe d'amis
   */
  async updateFriendGroup(
    groupId: ObjectId,
    userId: ObjectId,
    updates: Partial<FriendGroup>,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de modifier ce groupe",
        );
      }

      // Validation du nom s'il est modifié
      if (updates.name && updates.name !== group.name) {
        if (updates.name.length > 100) {
          return ResponseHelper.error(
            "Le nom du groupe ne doit pas dépasser 100 caractères",
            400,
          );
        }

        const existingGroup = await this.repository.getFriendGroupByName(
          userId,
          updates.name,
        );

        if (existingGroup && existingGroup._id) {
          return ResponseHelper.error("Un groupe avec ce nom existe déjà", 409);
        }
      }

      // Nettoyer les champs à ignorer
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, userId: _, members, createdAt, ...cleanedUpdates } = updates;

      const success = await this.repository.updateFriendGroup(
        groupId,
        cleanedUpdates,
      );

      if (!success) {
        return ResponseHelper.error(
          "Impossible de mettre à jour le groupe",
          500,
        );
      }

      const updatedGroup = await this.repository.getFriendGroupById(groupId);

      // Enrichir avec le nombre de membres
      const enrichedGroup = updatedGroup
        ? {
            ...updatedGroup,
            membersCount: updatedGroup.members?.length || 0,
          }
        : null;

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error updating friend group:", error);
      return ResponseHelper.error(
        "Erreur lors de la mise à jour du groupe",
        500,
      );
    }
  }

  /**
   * Supprime un groupe d'amis
   */
  async deleteFriendGroup(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de supprimer ce groupe",
        );
      }

      const success = await this.repository.deleteFriendGroup(groupId);

      if (!success) {
        return ResponseHelper.error("Impossible de supprimer le groupe", 500);
      }

      return ResponseHelper.success(
        { message: "Groupe supprimé avec succès" },
        200,
      );
    } catch (error) {
      console.error("Error deleting friend group:", error);
      return ResponseHelper.error(
        "Erreur lors de la suppression du groupe",
        500,
      );
    }
  }

  /**
   * Ajoute un ami à un groupe
   */
  async addMemberToGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de modifier ce groupe",
        );
      }

      // Vérifier que l'ami n'est pas déjà dans le groupe
      const isMember = await this.repository.isMemberInGroup(groupId, memberId);

      if (isMember) {
        return ResponseHelper.error("Cet ami est déjà dans le groupe", 400);
      }

      const success = await this.repository.addMemberToGroup(groupId, memberId);

      if (!success) {
        return ResponseHelper.error(
          "Impossible d'ajouter l'ami au groupe",
          500,
        );
      }

      // Mettre à jour le compteur de membres
      const membersCount = await this.repository.getMembersCount(groupId);
      await this.repository.updateMembersCount(groupId, membersCount);

      const updatedGroup = await this.repository.getFriendGroupById(groupId);

      // Enrichir avec le nombre de membres
      const enrichedGroup = updatedGroup
        ? {
            ...updatedGroup,
            membersCount,
          }
        : null;

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error adding member to group:", error);
      return ResponseHelper.error("Erreur lors de l'ajout de l'ami", 500);
    }
  }

  /**
   * Retire un ami d'un groupe
   */
  async removeMemberFromGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberId: ObjectId,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de modifier ce groupe",
        );
      }

      // Vérifier que l'ami est dans le groupe
      const isMember = await this.repository.isMemberInGroup(groupId, memberId);

      if (!isMember) {
        return ResponseHelper.error("Cet ami n'est pas dans le groupe", 400);
      }

      const success = await this.repository.removeMemberFromGroup(
        groupId,
        memberId,
      );

      if (!success) {
        return ResponseHelper.error(
          "Impossible de retirer l'ami du groupe",
          500,
        );
      }

      // Mettre à jour le compteur de membres
      const membersCount = await this.repository.getMembersCount(groupId);
      await this.repository.updateMembersCount(groupId, membersCount);

      const updatedGroup = await this.repository.getFriendGroupById(groupId);

      // Enrichir avec le nombre de membres
      const enrichedGroup = updatedGroup
        ? {
            ...updatedGroup,
            membersCount,
          }
        : null;

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error removing member from group:", error);
      return ResponseHelper.error(
        "Erreur lors de la suppression de l'ami",
        500,
      );
    }
  }

  /**
   * Ajoute plusieurs amis à un groupe
   */
  async addMembersToGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de modifier ce groupe",
        );
      }

      if (memberIds.length === 0) {
        return ResponseHelper.error("Aucun ami à ajouter", 400);
      }

      // Filtrer les amis qui ne sont pas déjà dans le groupe
      const existingMembers = group.members || [];
      const newMembers = memberIds.filter(
        (id) =>
          !existingMembers.some(
            (memberId) => memberId.toString() === id.toString(),
          ),
      );

      if (newMembers.length === 0) {
        return ResponseHelper.error(
          "Tous ces amis sont déjà dans le groupe",
          400,
        );
      }

      const success = await this.repository.addMembersToGroup(
        groupId,
        newMembers,
      );

      if (!success) {
        return ResponseHelper.error(
          "Impossible d'ajouter les amis au groupe",
          500,
        );
      }

      // Mettre à jour le compteur de membres
      const membersCount = await this.repository.getMembersCount(groupId);
      await this.repository.updateMembersCount(groupId, membersCount);

      const updatedGroup = await this.repository.getFriendGroupById(groupId);

      // Enrichir avec le nombre de membres
      const enrichedGroup = updatedGroup
        ? {
            ...updatedGroup,
            membersCount,
          }
        : null;

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error adding members to group:", error);
      return ResponseHelper.error("Erreur lors de l'ajout des amis", 500);
    }
  }

  /**
   * Retire plusieurs amis d'un groupe
   */
  async removeMembersFromGroup(
    groupId: ObjectId,
    userId: ObjectId,
    memberIds: ObjectId[],
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);

      if (!group) {
        return ResponseHelper.notFound("Groupe non trouvé");
      }

      // Vérifier que l'utilisateur est propriétaire du groupe
      if (group.userId.toString() !== userId.toString()) {
        return ResponseHelper.forbidden(
          "Vous n'avez pas la permission de modifier ce groupe",
        );
      }

      if (memberIds.length === 0) {
        return ResponseHelper.error("Aucun ami à retirer", 400);
      }

      const success = await this.repository.removeMembersFromGroup(
        groupId,
        memberIds,
      );

      if (!success) {
        return ResponseHelper.error(
          "Impossible de retirer les amis du groupe",
          500,
        );
      }

      // Mettre à jour le compteur de membres
      const membersCount = await this.repository.getMembersCount(groupId);
      await this.repository.updateMembersCount(groupId, membersCount);

      const updatedGroup = await this.repository.getFriendGroupById(groupId);

      // Enrichir avec le nombre de membres
      const enrichedGroup = updatedGroup
        ? {
            ...updatedGroup,
            membersCount,
          }
        : null;

      return ResponseHelper.success(enrichedGroup, 200);
    } catch (error) {
      console.error("Error removing members from group:", error);
      return ResponseHelper.error(
        "Erreur lors de la suppression des amis",
        500,
      );
    }
  }

  /**
   * Cherche des groupes d'amis
   */
  async searchFriendGroups(userId: ObjectId, query: string): Promise<Response> {
    try {
      if (!query || query.trim().length === 0) {
        return ResponseHelper.error("La requête de recherche est requise", 400);
      }

      const groups = await this.repository.searchFriendGroups(
        userId,
        query.trim(),
      );

      const enrichedGroups = groups.map((group) => ({
        ...group,
        membersCount: group.members?.length || 0,
      }));

      return ResponseHelper.success(enrichedGroups, 200);
    } catch (error) {
      console.error("Error searching friend groups:", error);
      return ResponseHelper.error("Erreur lors de la recherche", 500);
    }
  }
  async getUserGroups(userId: ObjectId): Promise<Response> {
    try {
      const groups = await this.repository.getUserGroups(userId);
      const enrichedGroups = groups.map((group) => ({
        ...group,
        membersCount: group.members?.length || 0,
      }));
      return ResponseHelper.success(enrichedGroups, 200);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      return ResponseHelper.error(
        "Erreur lors de la récupération des groupes",
        500,
      );
    }
  }
  async getGroupMembers(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const group = await this.repository.getFriendGroupById(groupId);
      if (!group) return ResponseHelper.notFound("Groupe non trouvé");
      const isMember =
        group.members.some((m) => m.toString() === userId.toString()) ||
        group.userId.toString() === userId.toString();
      if (!isMember)
        return ResponseHelper.forbidden("Vous n'êtes pas membre de ce groupe");
      const memberIds = group.members;
      const users = await this.userRepo.findByIds(memberIds);
      const enrichedMembers = users.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        image: user.image,
      }));
      return ResponseHelper.success(enrichedMembers, 200);
    } catch (error) {
      console.error("Error fetching group members:", error);
      return ResponseHelper.error(
        "Erreur lors de la récupération des membres",
        500,
      );
    }
  }
}
