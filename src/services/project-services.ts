import fs from "fs/promises";
import path from "path";
import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { Project } from "../models/project";
import { CollectionsManager } from "../models/base/collection-manager";
import type { IProjectRepository } from "../interfaces/project/i-project-repository";
import type { IProjectService } from "../interfaces/project/i-project-service";
import type { ICertificationRepository } from "../interfaces/skill/i-certification-repository";
import { ResponseHelper } from "../utils/response-helper";
import { handleFileUpload, type UploadResult } from "../utils/upload-helper";
import { UPLOAD_PATHS } from "../config/config";
import { FileService } from "../utils/file-service";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { COINS_CONFIG } from "../utils/coins-config";
import type { TransactionService } from "./transaction-services";

export class ProjectServices
  extends BaseService<Project>
  implements IProjectService
{
  constructor(
    private projectRepository: IProjectRepository,
    private certificationRepository: ICertificationRepository,
    private userRepository: IUserRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.projectCollection);
  }

  /**
   * Add Project with optional image upload
   */
  async addProject(
    userId: ObjectId,
    project: Project,
    formData: FormData,
  ): Promise<Response> {
    // Validation
    if (!project.title || !project.description || !project.startDate) {
      return ResponseHelper.error(
        "Veuillez compléter tous les champs obligatoires.",
      );
    }

    project.userId = userId;
    // Handle project image upload
    if (formData.has("image")) {
      const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.projects}`;

      const uploadResults = (await handleFileUpload(formData, {
        fieldName: "image",
        storePath,
        fileName: `project-${Date.now()}`,
        multiple: false,
        writeToDisk: true,
        userId,
      })) as UploadResult;

      if (uploadResults?.fileName) {
        const result = uploadResults;
        project.image = result?.fileName;
      }
    }

    // Handle technologies
    if (formData.has("technologies")) {
      const techsRaw = formData.get("technologies") as string;
      try {
        project.technologies = JSON.parse(techsRaw) as string[];
      } catch (err) {
        console.warn(`Invalid technologies format: ${String(err)}`);
        project.technologies = [];
      }
    }

    // Normalize dates
    if (typeof project.startDate === "string") {
      project.startDate = new Date(project.startDate);
    }
    if (project.endDate && typeof project.endDate === "string") {
      project.endDate = new Date(project.endDate);
    }

    project.current = String(project.current).toLowerCase() === "true";
    // Save project
    await this.projectRepository.addProject(project);

    // Add coins to user
    try {
      await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_PROJECT); // Plus de coins pour un projet
      await this.transactionService.addStandardEarning(
        userId,
        COINS_CONFIG.ADD_PROJECT,
        "project",
        project._id!,
        "Ajout d'un projet",
        {
          projectTitle: project.title,
          projectStartDate: project.startDate,
          projectEndDate: project.endDate,
        },
      );
    } catch (err) {
      console.error(`Error adding coins: ${String(err)}`);
    }

    return ResponseHelper.success(project);
  }

  /**
   * Update existing project
   */
  async updateProject(
    userId: ObjectId,
    projectId: ObjectId,
    project: Project,
    formData: FormData,
  ): Promise<Response> {
    try {
      // Check if project exists and belongs to user
      const existingProject = await this.collection.findOne({
        _id: projectId,
        userId: userId,
      });

      if (!existingProject) {
        return ResponseHelper.error("Project not found or access denied");
      }

      // Assign ID and userId
      project._id = projectId;
      project.userId = userId;
      project.updatedAt = new Date();

      // 1. Handle existing image deletion if new image is uploaded
      if (formData.has("image")) {
        // Delete old image if exists
        if (existingProject.image) {
          await this.deleteProjectImage(
            existingProject.image,
            userId.toString(),
          );
        }

        // Upload new image
        const storePath = `${UPLOAD_PATHS.images}-${userId}/${UPLOAD_PATHS.projects}`;
        const uploadResults = (await handleFileUpload(formData, {
          fieldName: "image",
          storePath,
          fileName: `project-${Date.now()}`,
          multiple: false,
          writeToDisk: true,
          userId,
        })) as UploadResult;

        if (uploadResults?.fileName) {
          project.image = uploadResults?.fileName;
        }
      } else {
        // Keep existing image
        project.image = existingProject.image;
      }
      // 5. Handle technologies
      if (formData.has("technologies")) {
        const techsRaw = formData.get("technologies") as string;
        try {
          project.technologies = JSON.parse(techsRaw) as string[];
        } catch {
          project.technologies = existingProject.technologies || [];
        }
      } else {
        project.technologies = existingProject.technologies || [];
      }

      // 6. Normalize dates
      if (project.startDate && typeof project.startDate === "string") {
        project.startDate = new Date(project.startDate);
      } else if (!project.startDate) {
        project.startDate = existingProject.startDate;
      }

      if (project.endDate && typeof project.endDate === "string") {
        project.endDate = new Date(project.endDate);
      } else {
        project.endDate = existingProject.endDate;
      }

      // 7. Handle other fields
      if (project.current !== undefined) {
        project.current = String(project.current).toLowerCase() === "true";
      } else {
        project.current = existingProject.current;
      }

      // Keep other fields if not provided
      project.title = project.title || existingProject.title;
      project.description = project.description || existingProject.description;
      project.category = project.category || existingProject.category;
      project.projectType = project.projectType || existingProject.projectType;
      project.liveUrl =
        project.liveUrl !== undefined
          ? project.liveUrl
          : existingProject.liveUrl;
      project.githubUrl =
        project.githubUrl !== undefined
          ? project.githubUrl
          : existingProject.githubUrl;
      project.featured =
        project.featured !== undefined
          ? project.featured
          : existingProject.featured;
      project.color = project.color || existingProject.color;

      // 8. Update project
      await this.projectRepository.updateProject(project);

      return ResponseHelper.success(project);
    } catch (err) {
      console.error("❌ Error updating project:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Delete project with associated files
   */
  async deleteProjectWithFiles(
    userId: ObjectId,
    projectId: ObjectId,
  ): Promise<Response> {
    try {
      // Verify project belongs to user
      const existingProject = await this.collection.findOne({
        _id: projectId,
        userId: userId,
      });

      if (!existingProject) {
        return ResponseHelper.error("Project not found or access denied");
      }

      // Remove coins from user
      try {
        await this.userRepository.removeCoins(userId, 10);
      } catch (err) {
        console.error("❌ Error removing coins:", err);
      }

      // Delete project image if exists
      if (existingProject.image) {
        await this.deleteProjectImage(existingProject.image, userId.toString());
      }
      try {
        await this.userRepository.removeCoins(
          userId,
          COINS_CONFIG.REMOVE_PROJECT,
        );
        await this.transactionService.addStandardSpending(
          userId,
          "project",
          projectId,
          `Suppression d'un projet`,
          COINS_CONFIG.REMOVE_PROJECT,
        );
      } catch (err) {
        console.error("❌ Erreur lors de la suppression des coins:", err);
        // Ne pas retourner une erreur ici - continuer la suppression
      }
      // Delete project
      await this.projectRepository.deleteProject(projectId, userId);

      // Clean empty directories
      await FileService.cleanEmptyCertificationDirectory(userId.toString());
      await this.cleanEmptyProjectDirectory(userId.toString());

      return ResponseHelper.success({
        message: "Project and associated files deleted successfully",
      });
    } catch (err) {
      console.error("❌ Error deleting project:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * Get projects by user ID
   */
  async getProjectsByUserId(userId: ObjectId): Promise<Project[]> {
    return this.projectRepository.getProjectsByUserId(userId);
  }

  /**
   * Helper method to delete project image
   */
  private async deleteProjectImage(
    imageUrl: string,
    userId: string,
  ): Promise<void> {
    try {
      const basePath = process.cwd();
      const fullPath = path.join(
        basePath,
        "uploads",
        `images-${userId}`,
        UPLOAD_PATHS.projects,
        imageUrl,
      );

      await FileService.deleteFile(fullPath);
    } catch (error) {
      console.error(`Error deleting project image ${imageUrl}:`, error);
    }
  }

  /**
   * Helper method to clean empty project directory
   */
  private async cleanEmptyProjectDirectory(userId: string): Promise<void> {
    try {
      const projectDir = path.join(
        process.cwd(),
        "uploads",
        `images-${userId}`,
        UPLOAD_PATHS.projects,
      );

      await fs.readdir(projectDir, { withFileTypes: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.warn(`⚠️ Unable to clean project directory:`, error);
      }
    }
  }
}
