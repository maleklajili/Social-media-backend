import type { ObjectId } from "mongodb";
import type { Company } from "../../models/company";

export interface ICompanyService {
  addCompany(
    userId: ObjectId,
    company: Company,
    formData: FormData,
  ): Promise<Response>;
  updateCompany(
    userId: ObjectId,
    companyId: ObjectId,
    company: Company,
    formData: FormData,
  ): Promise<Response>;
  deleteCompany(
    currentUserId: ObjectId,
    companyId: ObjectId,
    isAdmin: boolean,
  ): Promise<Response>;
  getCompaniesByUserId(userId: ObjectId): Promise<Response>;
  getCompanyById(companyId: ObjectId): Promise<Response>;
  getAggregatedStats(): Promise<{
    totalCompanies: number;
    totalJobs: number;
    totalLocations: number;
    totalIndustries: number;
  }>;
  followCompany(currentUserId: ObjectId, companyId: string): Promise<Response>;
  unfollowCompany(
    currentUserId: ObjectId,
    companyId: string,
  ): Promise<Response>;
  getCompanyFollowers(
    companyId: string,
    currentUserId?: ObjectId,
  ): Promise<Response>;
  getCompanyFollowStatus(
    currentUserId: ObjectId,
    companyId: string,
  ): Promise<Response>;
  getCompanyByIdWithFollowStatus(
    companyId: ObjectId,
    userId: ObjectId,
  ): Promise<Response>;
  getAllCompaniesWithFollowStatus(
    userId: ObjectId,
    filter?: Record<string, Company>,
    pagination?: { skip: number; limit: number },
  ): Promise<{ data: Company[]; total: number }>;
}
