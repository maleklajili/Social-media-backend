import type { ObjectId } from "mongodb";
import type { Certification } from "../../models/certifications";

export interface ICertificationRepository {
  addCertification(certification: Certification): Promise<Certification>;
  deleteOne(id: ObjectId): Promise<void>;
  findById(id: ObjectId): Promise<Certification | null>;
  getCertificationsByIds(ids: ObjectId[]): Promise<Certification[]>;
  deleteCertificationsByIds(ids: ObjectId[]): Promise<void>;
}
