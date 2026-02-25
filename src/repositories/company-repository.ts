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
    return locations.length; // retourne bien un number
  }
}
