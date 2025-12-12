import type { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Project } from "../models/project";
import type { IProjectRepository } from "../interfaces/project/i-project-repository";

export class ProjectRepository implements IProjectRepository {
  private collection = CollectionsManager.projectCollection;

  async addProject(project: Project): Promise<void> {
    project.createdAt = new Date();
    project.updatedAt = new Date();
    await this.collection.insertOne(project);
  }

  async updateProject(project: Project): Promise<void> {
    const { _id, ...data } = project;
    data.updatedAt = new Date();
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteProject(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  async getProjectsByUserId(userId: ObjectId): Promise<Project[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getProjectById(id: ObjectId): Promise<Project | null> {
    return this.collection.findOne({ _id: id });
  }
}
