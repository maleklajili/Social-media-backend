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
    return this.collection.findOne({
      _id: id,
    }) as Promise<JobApplication | null>;
  }

  async getApplicationsByJobId(jobId: ObjectId): Promise<JobApplication[]> {
    return this.collection
      .find({ jobId })
      .sort({ appliedAt: -1 })
      .toArray() as Promise<JobApplication[]>;
  }

  async getApplicationsByUserId(
    userId: ObjectId,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }> {
    try {
      const filter = { userId };

      const total = await this.collection.countDocuments(filter);

      // Utiliser aggregate avec $lookup pour joindre les données des jobs et des entreprises
      const aggregation = this.collection.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        // Joindre les détails du job
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "jobDetails",
          },
        },
        {
          $unwind: {
            path: "$jobDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Joindre les détails de l'entreprise
        {
          $lookup: {
            from: "companies",
            localField: "companyId",
            foreignField: "_id",
            as: "companyDetails",
          },
        },
        {
          $unwind: {
            path: "$companyDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Ajouter les champs enrichis
        {
          $addFields: {
            jobTitle: { $ifNull: ["$jobDetails.title", "Offre d'emploi"] },
            location: { $ifNull: ["$jobDetails.location", "Non spécifié"] },
            contractType: {
              $ifNull: ["$jobDetails.contractType", "Non spécifié"],
            },
            companyName: { $ifNull: ["$companyDetails.name", "Entreprise"] },
            companyLogo: { $ifNull: ["$companyDetails.logo", ""] },
            companyUserId: "$companyDetails.userId",
          },
        },
        // Supprimer les champs temporaires
        {
          $project: {
            jobDetails: 0,
            companyDetails: 0,
          },
        },
      ]);

      if (pagination) {
        aggregation.skip(pagination.skip).limit(pagination.limit);
      }

      const data = (await aggregation.toArray()) as JobApplication[];

      return { data, total };
    } catch (err) {
      console.error("❌ Error getting applications by user ID:", err);
      throw err;
    }
  }

  async getApplicationsByCompanyId(
    companyId: ObjectId,
  ): Promise<JobApplication[]> {
    return this.collection
      .find({ companyId })
      .sort({ appliedAt: -1 })
      .toArray() as Promise<JobApplication[]>;
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
    return this.collection
      .find(filter)
      .sort({ appliedAt: -1 })
      .toArray() as Promise<JobApplication[]>;
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
      .toArray() as Promise<JobApplication[]>;
  }
}
