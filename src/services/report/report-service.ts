import { ObjectId } from "mongodb";
import { ResponseHelper } from "../../utils/response-helper";
import type { IReportService } from "../../interfaces/report/i-report-service";
import type {
  Report,
  ReportedItemType,
  ReportStatus,
  ReportReason,
} from "../../models/report";
import { ReportRepository } from "../../repositories/report/report-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import { userRepository } from "../../repositories/user-repository";
import populateReferences from "../../utils/populate";

export class ReportService implements IReportService {
  private reportRepository: ReportRepository;
  private userRepository: userRepository;

  constructor() {
    this.reportRepository = new ReportRepository();
    this.userRepository = new userRepository();
  }

  async createReport(
    reportedItemId: ObjectId,
    reportedItemType: ReportedItemType,
    reportedById: ObjectId,
    reason: string,
    description: string,
  ): Promise<Response> {
    try {
      // Validation des paramètres
      if (!ObjectId.isValid(reportedItemId)) {
        return ResponseHelper.error("Invalid reported item ID");
      }

      if (!ObjectId.isValid(reportedById)) {
        return ResponseHelper.error("Invalid user ID");
      }

      if (!reason || typeof reason !== "string") {
        return ResponseHelper.error("Invalid reason provided");
      }

      // Vérifier si le signalement est en doublon
      const isDuplicate = await this.reportRepository.checkDuplicateReport(
        reportedItemId,
        reportedById,
      );

      if (isDuplicate) {
        return ResponseHelper.error(
          "You have already reported this item. Our team is reviewing it.",
        );
      }

      // Vérifier que l'utilisateur ne peut pas signaler son propre contenu
      if (reportedItemType === "post" || reportedItemType === "comment") {
        const collection =
          reportedItemType === "post"
            ? CollectionsManager.postCollection
            : CollectionsManager.commentCollection;

        const item = await collection.findOne({ _id: reportedItemId });

        if (!item) {
          return ResponseHelper.error(`${reportedItemType} not found`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemUserId = (item as any).userId;
        if (itemUserId.equals(reportedById)) {
          return ResponseHelper.error("You cannot report your own content");
        }
      }

      // Créer le rapport
      const report: Report = {
        _id: new ObjectId(),
        reportedItemType,
        reportedItemId,
        reportedById,
        reportReason: reason as ReportReason,
        description: description || "",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdReport = await this.reportRepository.addReport(report);

      return ResponseHelper.success(
        { _id: createdReport._id, status: "pending" },
        201,
      );
    } catch (err) {
      console.error("Error creating report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getReportById(reportId: ObjectId): Promise<Response> {
    try {
      if (!ObjectId.isValid(reportId)) {
        return ResponseHelper.error("Invalid report ID");
      }

      const report = await this.reportRepository.getReportById(reportId);

      if (!report) {
        return ResponseHelper.error("Report not found");
      }

      return ResponseHelper.success(report);
    } catch (err) {
      console.error("Error fetching report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getAllReports(
    page: number = 1,
    limit: number = 20,
    status?: ReportStatus,
  ): Promise<Response> {
    try {
      const reports = await this.reportRepository.getAllReports(
        page,
        limit,
        status,
      );
      const totalCount =
        await this.reportRepository.countReportsByStatus(status);
      // Populate sharedBy array with public user fields
      try {
        await populateReferences(
          reports,
          this.userRepository,
          "reportedById",
          "reportedBy",
          ["_id", "firstName", "lastName", "image"],
          true, // This tells the function to handle it as an array
        );
      } catch (err) {
        console.error("Failed to populate sharedBy users for posts:", err);
      }
      return ResponseHelper.success({
        reports,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      console.error("Error fetching reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getReportsByUser(userId: ObjectId): Promise<Response> {
    try {
      if (!ObjectId.isValid(userId)) {
        return ResponseHelper.error("Invalid user ID");
      }

      const reports = await this.reportRepository.getReportsByUser(userId);

      return ResponseHelper.success(reports);
    } catch (err) {
      console.error("Error fetching user reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getReportsByItem(
    itemId: ObjectId,
    itemType: ReportedItemType,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(itemId)) {
        return ResponseHelper.error("Invalid item ID");
      }

      const reports = await this.reportRepository.getReportsByItem(
        itemId,
        itemType,
      );

      return ResponseHelper.success({
        item: { _id: itemId, type: itemType },
        reports,
        totalReports: reports.length,
      });
    } catch (err) {
      console.error("Error fetching item reports:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateReportStatus(
    reportId: ObjectId,
    status: ReportStatus,
    resolvedBy: ObjectId,
    resolutionNotes?: string,
  ): Promise<Response> {
    try {
      if (!ObjectId.isValid(reportId)) {
        return ResponseHelper.error("Invalid report ID");
      }

      if (!ObjectId.isValid(resolvedBy)) {
        return ResponseHelper.error("Invalid admin ID");
      }

      const validStatuses = ["pending", "reviewing", "resolved", "dismissed"];
      if (!validStatuses.includes(status)) {
        return ResponseHelper.error("Invalid status");
      }

      const updatedReport = await this.reportRepository.updateReportStatus(
        reportId,
        status,
        resolvedBy,
        resolutionNotes,
      );

      if (!updatedReport) {
        return ResponseHelper.error("Report not found");
      }

      return ResponseHelper.success(updatedReport);
    } catch (err) {
      console.error("Error updating report status:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteReport(reportId: ObjectId): Promise<Response> {
    try {
      if (!ObjectId.isValid(reportId)) {
        return ResponseHelper.error("Invalid report ID");
      }

      const deleted = await this.reportRepository.deleteReport(reportId);

      if (!deleted) {
        return ResponseHelper.error("Report not found");
      }

      return ResponseHelper.success({ success: true });
    } catch (err) {
      console.error("Error deleting report:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getReportStats(): Promise<Response> {
    try {
      const pendingCount =
        await this.reportRepository.countReportsByStatus("pending");
      const reviewingCount =
        await this.reportRepository.countReportsByStatus("reviewing");
      const resolvedCount =
        await this.reportRepository.countReportsByStatus("resolved");
      const dismissedCount =
        await this.reportRepository.countReportsByStatus("dismissed");

      return ResponseHelper.success({
        pending: pendingCount,
        reviewing: reviewingCount,
        resolved: resolvedCount,
        dismissed: dismissedCount,
        total: pendingCount + reviewingCount + resolvedCount + dismissedCount,
      });
    } catch (err) {
      console.error("Error fetching report stats:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
