import type { ObjectId } from "mongodb";
import type { ManualCv } from "../../models/manual-cv";

export interface IManualCvRepository {
  create(cv: ManualCv): Promise<void>;
  getByUserId(userId: ObjectId): Promise<ManualCv[]>;
  getById(id: ObjectId, userId: ObjectId): Promise<ManualCv | null>;
  update(
    id: ObjectId,
    userId: ObjectId,
    data: Partial<ManualCv>,
  ): Promise<boolean>;
  deleteById(id: ObjectId, userId: ObjectId): Promise<boolean>;
}
