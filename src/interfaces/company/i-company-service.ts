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
  deleteCompany(userId: ObjectId, companyId: ObjectId): Promise<Response>;
  getCompaniesByUserId(userId: ObjectId): Promise<Response>;
  getCompanyById(companyId: ObjectId): Promise<Response>;
}
