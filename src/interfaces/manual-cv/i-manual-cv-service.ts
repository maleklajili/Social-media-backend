import type { ObjectId } from "mongodb";
import type { ManualCvFormat } from "../../models/manual-cv";

export interface IManualCvService {
  createCv(userId: ObjectId, data: Record<string, unknown>): Promise<Response>;
  getUserCvs(userId: ObjectId): Promise<Response>;
  getCvById(userId: ObjectId, cvId: ObjectId): Promise<Response>;
  updateCv(
    userId: ObjectId,
    cvId: ObjectId,
    data: Record<string, unknown>,
  ): Promise<Response>;
  deleteCv(userId: ObjectId, cvId: ObjectId): Promise<Response>;
  downloadPdf(userId: ObjectId, cvId: ObjectId): Promise<Response>;
  importFromProfile(
    userId: ObjectId,
    format: ManualCvFormat,
    language: string,
  ): Promise<Response>;
}
