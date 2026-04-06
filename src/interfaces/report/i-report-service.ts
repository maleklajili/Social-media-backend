import type { ObjectId } from "mongodb";
import type { ReportedItemType, ReportStatus } from "../../models/report";

export interface IReportService {
  createReport(
    reportedItemId: ObjectId,
    reportedItemType: ReportedItemType,
    reportedById: ObjectId,
    reason: string,
    description: string,
  ): Promise<Response>;

  getReportById(reportId: ObjectId): Promise<Response>;

  getAllReports(
    page: number,
    limit: number,
    status?: ReportStatus,
  ): Promise<Response>;

  getReportsByUser(userId: ObjectId): Promise<Response>;

  getReportsByItem(
    itemId: ObjectId,
    itemType: ReportedItemType,
  ): Promise<Response>;

  updateReportStatus(
    reportId: ObjectId,
    status: ReportStatus,
    resolvedBy: ObjectId,
    resolutionNotes?: string,
  ): Promise<Response>;

  deleteReport(reportId: ObjectId): Promise<Response>;

  getReportStats(): Promise<Response>;
}
