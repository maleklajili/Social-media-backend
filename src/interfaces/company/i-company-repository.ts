import type { ObjectId } from "mongodb";
import type { Company } from "../../models/company";

export interface ICompanyRepository {
  addCompany(company: Company): Promise<void>;
  updateCompany(company: Company): Promise<void>;
  deleteCompany(id: ObjectId, userId: ObjectId): Promise<boolean>;
  getCompaniesByUserId(userId: ObjectId): Promise<Company[]>;
  getCompanyById(id: ObjectId): Promise<Company | null>;
  countCompanies(): Promise<number>;
  countDistinctIndustries(): Promise<number>;
  countDistinctLocations(): Promise<number>;
  addJobToCompany(companyId: ObjectId, jobId: ObjectId): Promise<void>;
  removeJobFromCompany(companyId: ObjectId, jobId: ObjectId): Promise<void>;
  getCompanyJobs(companyId: ObjectId): Promise<ObjectId[]>;
  followCompany(userId: ObjectId, companyId: ObjectId): Promise<void>;
  unfollowCompany(userId: ObjectId, companyId: ObjectId): Promise<void>;
  isFollowing(userId: ObjectId, companyId: ObjectId): Promise<boolean>;
  getFollowers(companyId: ObjectId): Promise<ObjectId[]>;
  getFollowCount(companyId: ObjectId): Promise<number>;
  findCompaniesByIds(ids: ObjectId[]): Promise<Company[]>;
  updateCompanyStats(
    companyId: ObjectId,
    stats: { averageRating: number; reviewCount: number },
  ): Promise<void>;
  incrementViews(companyId: ObjectId): Promise<void>;
  getViewCount(companyId: ObjectId): Promise<number>;
  addPostToCompany(companyId: ObjectId, postId: ObjectId): Promise<void>;
  removePostFromCompany(companyId: ObjectId, postId: ObjectId): Promise<void>;
  getCompanyPosts(companyId: ObjectId): Promise<ObjectId[]>;
}
