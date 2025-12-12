import type { ObjectId } from "mongodb";
import type { Project } from "../../models/project";

export interface IProjectService {
  addProject(
    userId: ObjectId,
    project: Project,
    formData: FormData,
  ): Promise<Response>;

  updateProject(
    userId: ObjectId,
    projectId: ObjectId,
    project: Project,
    formData: FormData,
  ): Promise<Response>;

  deleteProjectWithFiles(
    userId: ObjectId,
    projectId: ObjectId,
  ): Promise<Response>;

  getProjectsByUserId(userId: ObjectId): Promise<Project[]>;
}
