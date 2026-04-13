import type { ObjectId } from "mongodb";
import type { AiCvSection, AiCvFormat } from "../../models/ai-cv";

export interface IAiCvService {
  generateCv(
    userId: ObjectId,
    language: string,
    section: AiCvSection,
    format: AiCvFormat,
    customPrompt?: string,
  ): Promise<Response>;
  reformulateCv(
    userId: ObjectId,
    aiCvId: ObjectId,
    instructions?: string,
  ): Promise<Response>;
  getUserCvs(userId: ObjectId): Promise<Response>;
  deleteCv(userId: ObjectId, cvId: ObjectId): Promise<Response>;
  downloadPdf(
    userId: ObjectId,
    cvId: ObjectId,
    primaryColor?: string,
    accentColor?: string,
    fontFamily?: string,
    formatOverride?: string,
  ): Promise<Response>;
}
