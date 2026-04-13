import { ObjectId, type Collection } from "mongodb";
import type {
  Report,
  ReportedItemType,
  ReportStatus,
} from "../../models/report";
import { CollectionsManager } from "../../models/base/collection-manager";

export interface IReportRepository {
  addReport(report: Report): Promise<Report>;
  getReportById(id: ObjectId): Promise<Report | null>;
  getAllReports(
    page: number,
    limit: number,
    status?: ReportStatus,
  ): Promise<Report[]>;
  getReportsByUser(userId: ObjectId): Promise<Report[]>;
  getReportsByItem(
    itemId: ObjectId,
    itemType: ReportedItemType,
  ): Promise<Report[]>;
  updateReportStatus(
    reportId: ObjectId,
    status: ReportStatus,
    resolvedBy?: ObjectId,
    resolutionNotes?: string,
  ): Promise<Report | null>;
  deleteReport(id: ObjectId): Promise<boolean>;
  countReportsByStatus(status?: ReportStatus): Promise<number>;
  checkDuplicateReport(
    reportedItemId: ObjectId,
    reportedById: ObjectId,
  ): Promise<boolean>;
}

export class ReportRepository implements IReportRepository {
  private collection: Collection<Report>;

  constructor() {
    this.collection = CollectionsManager.reportCollection;
  }

  async addReport(report: Report): Promise<Report> {
    report._id = new ObjectId();
    report.createdAt = new Date();
    report.updatedAt = new Date();
    report.status = "pending";

    await this.collection.insertOne(report);
    return report;
  }

  async getReportById(id: ObjectId): Promise<Report | null> {
    return await this.collection.findOne({ _id: id });
  }

  async getAllReports(
    page: number = 1,
    limit: number = 20,
    status?: ReportStatus,
  ): Promise<Report[]> {
    const skip = (page - 1) * limit;
    const query = status ? { status } : {};

    return await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getReportsByUser(userId: ObjectId): Promise<Report[]> {
    return await this.collection
      .find({ reportedById: userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getReportsByItem(
    itemId: ObjectId,
    itemType: ReportedItemType,
  ): Promise<Report[]> {
    return await this.collection
      .find({ reportedItemId: itemId, reportedItemType: itemType })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async updateReportStatus(
    reportId: ObjectId,
    status: ReportStatus,
    resolvedBy?: ObjectId,
    resolutionNotes?: string,
  ): Promise<Report | null> {
    const update: Partial<Report> = {
      status,
      updatedAt: new Date(),
    };

    if (resolvedBy) {
      update.resolvedBy = resolvedBy;
      update.resolvedAt = new Date();
    }

    if (resolutionNotes) {
      update.resolutionNotes = resolutionNotes;
    }

    const result = await this.collection.findOneAndUpdate(
      { _id: reportId },
      { $set: update },
      { returnDocument: "after" },
    );

    return result ?? null;
  }

  async deleteReport(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async countReportsByStatus(status?: ReportStatus): Promise<number> {
    const query = status ? { status } : {};
    return await this.collection.countDocuments(query);
  }

  async checkDuplicateReport(
    reportedItemId: ObjectId,
    reportedById: ObjectId,
  ): Promise<boolean> {
    const report = await this.collection.findOne({
      reportedItemId,
      reportedById,
      status: "pending",
    });
    return !!report;
  }
}
