// repositories/job-application-repository.ts
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
    // ✅ Ajouter un lookup pour récupérer l'avatar de l'utilisateur
    const result = await this.collection
      .aggregate([
        { $match: { _id: id } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
          },
        },
        {
          $project: {
            userDetails: 0,
          },
        },
      ])
      .toArray();

    return (result[0] as JobApplication) || null;
  }

  async updateApplicationScore(
    applicationId: ObjectId,
    score: number,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: applicationId },
      { $set: { score, updatedAt: new Date() } },
    );
  }

  async getApplicationsByJobId(jobId: ObjectId): Promise<JobApplication[]> {
    // ✅ Ajouter un lookup pour récupérer l'avatar des utilisateurs
    return this.collection
      .aggregate([
        { $match: { jobId } },
        { $sort: { appliedAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
          },
        },
        {
          $project: {
            userDetails: 0,
          },
        },
      ])
      .toArray() as Promise<JobApplication[]>;
  }

  async getApplicationsByJobIdRanked(
    jobId: ObjectId,
  ): Promise<JobApplication[]> {
    return this.collection
      .aggregate([
        { $match: { jobId } },
        { $sort: { score: -1, appliedAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
            professionalTitle: {
              $ifNull: ["$userDetails.professionalTitle", null],
            },
          },
        },
        { $project: { userDetails: 0 } },
      ])
      .toArray() as Promise<JobApplication[]>;
  }

  async getApplicationsByUserId(
    userId: ObjectId,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }> {
    try {
      const filter = { userId };
      const total = await this.collection.countDocuments(filter);

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
        // ✅ Joindre les détails de l'utilisateur pour l'avatar
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
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
            avatar: { $ifNull: ["$userDetails.image", null] }, // ✅ Avatar du candidat
            // Add CV URL
            cvUrl: {
              $cond: [
                { $ifNull: ["$cvFileName", false] },
                {
                  $concat: [
                    "/api/job-applications/",
                    { $toString: "$_id" },
                    "/cv",
                  ],
                },
                null,
              ],
            },
          },
        },
        // Supprimer les champs temporaires
        {
          $project: {
            jobDetails: 0,
            companyDetails: 0,
            userDetails: 0,
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
    // ✅ Ajouter un lookup pour récupérer l'avatar des utilisateurs
    return this.collection
      .aggregate([
        { $match: { companyId } },
        { $sort: { appliedAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
          },
        },
        {
          $project: {
            userDetails: 0,
          },
        },
      ])
      .toArray() as Promise<JobApplication[]>;
  }

  async getApplicationsByStatus(
    status: string,
    companyId?: ObjectId,
  ): Promise<JobApplication[]> {
    const filter: { status: string; companyId?: ObjectId } = { status };
    if (companyId) {
      filter.companyId = companyId;
    }
    // ✅ Ajouter un lookup pour récupérer l'avatar des utilisateurs
    return this.collection
      .aggregate([
        { $match: filter },
        { $sort: { appliedAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
          },
        },
        {
          $project: {
            userDetails: 0,
          },
        },
      ])
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
    status: string,
  ): Promise<JobApplication[]> {
    // ✅ Ajouter un lookup pour récupérer l'avatar des utilisateurs
    return this.collection
      .aggregate([
        { $match: { jobId, status } },
        { $sort: { appliedAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            avatar: { $ifNull: ["$userDetails.image", null] },
          },
        },
        {
          $project: {
            userDetails: 0,
          },
        },
      ])
      .toArray() as Promise<JobApplication[]>;
  }
}
