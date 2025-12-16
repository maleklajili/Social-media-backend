import type { ObjectId } from "mongodb";
import type { ILanguageRepository } from "../../interfaces/skills/i-language-repository";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Language } from "../../models/skills/language";

export class LanguageRepository implements ILanguageRepository {
  private collection = CollectionsManager.languageCollection;

  async getLanguagesByUserId(userId: ObjectId): Promise<Language[]> {
    return this.collection.find({ userId }).toArray();
  }

  async getLanguageById(id: ObjectId): Promise<Language | null> {
    return this.collection.findOne({ _id: id });
  }

  async addLanguage(language: Language): Promise<Language> {
    await this.collection.insertOne(language);
    return language;
  }

  async updateLanguage(
    id: ObjectId,
    language: Partial<Language>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...language, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async deleteLanguage(id: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
