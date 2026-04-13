import type { ObjectId } from "mongodb";
import type { AiCv } from "../../models/ai-cv";

export interface IAiCvRepository {
  create(aiCv: AiCv): Promise<void>;
  getByUserId(userId: ObjectId): Promise<AiCv[]>;
  getById(id: ObjectId, userId: ObjectId): Promise<AiCv | null>;
  deleteById(id: ObjectId, userId: ObjectId): Promise<boolean>;
}
