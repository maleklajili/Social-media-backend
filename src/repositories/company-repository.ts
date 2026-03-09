import type { ObjectId } from "mongodb";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Company } from "../models/company";

export class CompanyRepository implements ICompanyRepository {
  private collection = CollectionsManager.companyCollection;

  async addCompany(company: Company): Promise<void> {
    await this.collection.insertOne(company);
  }

  async updateCompany(company: Company): Promise<void> {
    const { _id, ...data } = company;
    await this.collection.updateOne({ _id }, { $set: data });
  }

  async deleteCompany(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  async getCompaniesByUserId(userId: ObjectId): Promise<Company[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getCompanyById(id: ObjectId): Promise<Company | null> {
    return this.collection.findOne({ _id: id });
  }

  async countCompanies(): Promise<number> {
    return this.collection.countDocuments();
  }

  async countDistinctIndustries(): Promise<number> {
    const industries = await this.collection.distinct("industry");
    return industries.length;
  }

  async countDistinctLocations(): Promise<number> {
    const locations = await this.collection.distinct("location");
    return locations.length;
  }

  async addJobToCompany(companyId: ObjectId, jobId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      {
        $addToSet: { jobs: jobId },
        $inc: { "stats.jobApplications": 1 },
      },
    );
  }

  async removeJobFromCompany(
    companyId: ObjectId,
    jobId: ObjectId,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      {
        $pull: { jobs: jobId },
        $inc: { "stats.jobApplications": -1 },
      },
    );
  }

  async getCompanyJobs(companyId: ObjectId): Promise<ObjectId[]> {
    const company = await this.collection.findOne(
      { _id: companyId },
      { projection: { jobs: 1 } },
    );
    return company?.jobs || [];
  }

  async followCompany(userId: ObjectId, companyId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      {
        $addToSet: { followersId: userId },
        $inc: { "stats.followers": 1 },
      },
    );
  }

  async unfollowCompany(userId: ObjectId, companyId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      {
        $pull: { followersId: userId },
        $inc: { "stats.followers": -1 },
      },
    );
  }

  async isFollowing(userId: ObjectId, companyId: ObjectId): Promise<boolean> {
    const company = await this.collection.findOne(
      { _id: companyId, followersId: userId },
      { projection: { _id: 1 } },
    );
    return !!company;
  }

  async getFollowers(companyId: ObjectId): Promise<ObjectId[]> {
    const company = await this.collection.findOne(
      { _id: companyId },
      { projection: { followersId: 1 } },
    );
    return company?.followersId || [];
  }

  async getFollowCount(companyId: ObjectId): Promise<number> {
    const company = await this.collection.findOne(
      { _id: companyId },
      { projection: { "stats.followers": 1 } },
    );
    return company?.stats?.followers || 0;
  }

  async findCompaniesByIds(ids: ObjectId[]): Promise<Company[]> {
    if (!ids || ids.length === 0) return [];
    return this.collection.find({ _id: { $in: ids } }).toArray();
  }

  async updateCompanyStats(
    companyId: ObjectId,
    stats: { averageRating: number; reviewCount: number },
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: companyId },
      {
        $set: {
          averageRating: stats.averageRating,
          reviewCount: stats.reviewCount,
        },
      },
    );
  }
}
