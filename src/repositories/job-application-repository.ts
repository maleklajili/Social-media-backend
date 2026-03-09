import type { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { JobApplication } from "../models/job-application";
import type { IJobApplicationRepository } from "../interfaces/job/i-job-application-repository";

export class JobApplicationRepository implements IJobApplicationRepository {
  private collection = CollectionsManager.jobApplicationCollection;

  async addApplication(application: JobApplication): Promise<void> {
    await this.collection.insertOne(application);
  }

  async updateApplication(application: JobApplication): Promise<void> {
    const { _id, ...data } = application;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteApplication(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async getApplicationById(id: ObjectId): Promise<JobApplication | null> {
    return this.collection.findOne({ _id: id });
  }

  async getApplicationsByJobId(jobId: ObjectId): Promise<JobApplication[]> {
    return this.collection.find({ jobId }).sort({ appliedAt: -1 }).toArray();
  }

  async getApplicationsByUserId(userId: ObjectId): Promise<JobApplication[]> {
    return this.collection.find({ userId }).sort({ appliedAt: -1 }).toArray();
  }

  async getApplicationsByCompanyId(
    companyId: ObjectId,
  ): Promise<JobApplication[]> {
    return this.collection
      .find({ companyId })
      .sort({ appliedAt: -1 })
      .toArray();
  }

  async getApplicationsByStatus(
    status: "pending" | "viewed" | "accepted" | "rejected" | "withdrawn",
    companyId?: ObjectId,
  ): Promise<JobApplication[]> {
    const filter: {
      status: "pending" | "viewed" | "accepted" | "rejected" | "withdrawn";
      companyId?: ObjectId;
    } = { status };
    if (companyId) {
      filter.companyId = companyId;
    }
    return this.collection.find(filter).sort({ appliedAt: -1 }).toArray();
  }

  async hasAlreadyApplied(jobId: ObjectId, userId: ObjectId): Promise<boolean> {
    const application = await this.collection.findOne({
      jobId,
      userId,
      status: { $ne: "withdrawn" },
    });
    return !!application;
  }

  async countApplicationsForJob(jobId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ jobId });
  }

  async countApplicationsForUser(userId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ userId });
  }

  async countApplicationsForCompany(companyId: ObjectId): Promise<number> {
    return this.collection.countDocuments({ companyId });
  }

  async getApplicationsByJobAndStatus(
    jobId: ObjectId,
    status: "pending" | "viewed" | "accepted" | "rejected" | "withdrawn",
  ): Promise<JobApplication[]> {
    return this.collection
      .find({ jobId, status })
      .sort({ appliedAt: -1 })
      .toArray();
  }
}
