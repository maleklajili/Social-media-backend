import type { ObjectId } from "mongodb";
import type { Project } from "../../models/project";

export interface IProjectRepository {
  addProject(project: Project): Promise<void>;
  updateProject(project: Project): Promise<void>;
  deleteProject(id: ObjectId, userId: ObjectId): Promise<boolean>;
  getProjectsByUserId(userId: ObjectId): Promise<Project[]>;
  getProjectById(id: ObjectId): Promise<Project | null>;
}
