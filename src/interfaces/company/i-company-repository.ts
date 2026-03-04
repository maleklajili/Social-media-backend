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
}
