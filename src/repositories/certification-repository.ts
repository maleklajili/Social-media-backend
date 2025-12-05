import type { ObjectId } from "mongodb";
import type { ICertificationRepository } from "../interfaces/skill/i-certification-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Certification } from "../models/certifications";

export class CertificationRepository implements ICertificationRepository {
  async findById(id: ObjectId): Promise<Certification | null> {
    return await this.collection.findOne({ _id: id });
  }

  private collection = CollectionsManager.certificationCollection;
  async addCertification(certification: Certification): Promise<Certification> {
    const result = await this.collection.insertOne(certification);
    return { ...certification, _id: result.insertedId };
  }

  async deleteOne(id: ObjectId): Promise<void> {
    await this.collection.deleteOne({ _id: id });
  }

  async deleteCertificationsByIds(ids: ObjectId[]): Promise<void> {
    if (ids.length === 0) return;

    await this.collection.deleteMany({
      _id: { $in: ids },
    });
  }
  async getCertificationsByIds(ids: ObjectId[]): Promise<Certification[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const certifications = await this.collection
      .find({ _id: { $in: ids } })
      .toArray();

    return certifications as Certification[];
  }
}
