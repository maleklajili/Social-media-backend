import type { ObjectId } from "mongodb";
import type { IJobRepository } from "../interfaces/job/i-job-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Job } from "../models/job";

export class JobRepository implements IJobRepository {
  private collection = CollectionsManager.jobCollection;

  async addJob(job: Job): Promise<void> {
    await this.collection.insertOne(job);
  }

  async updateJob(job: Job): Promise<void> {
    const { _id, ...data } = job;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteJob(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  async getJobsByCompanyId(companyId: ObjectId): Promise<Job[]> {
    return this.collection.find({ companyId }).toArray();
  }

  async getJobsByUserId(userId: ObjectId): Promise<Job[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getJobById(id: ObjectId): Promise<Job | null> {
    return this.collection.findOne({ _id: id });
  }

  async getActiveJobs(filters?: {
    location?: string;
    contractType?: string;
    experience?: string;
    skills?: string[];
  }): Promise<Job[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { status: "active" };

    if (filters?.location) {
      query.location = { $regex: filters.location, $options: "i" };
    }

    if (filters?.contractType) {
      query.contractType = filters.contractType;
    }

    if (filters?.experience) {
      query.experience = filters.experience;
    }

    if (filters?.skills && filters.skills.length > 0) {
      query.skills = { $in: filters.skills };
    }

    return this.collection.find(query).toArray();
  }
  async countJobs(): Promise<number> {
    return this.collection.countDocuments();
  }
  async getAllJobsForAdmin(
    page: number,
    limit: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ jobs: any; total: number }> {
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ];

    const jobs = await this.collection.aggregate(pipeline).toArray();
    const total = await this.collection.countDocuments();

    return { jobs, total };
  }
}
