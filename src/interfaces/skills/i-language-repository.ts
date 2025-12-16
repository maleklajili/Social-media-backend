import type { ObjectId } from "mongodb";
import type { Language } from "../../models/skills/language";

export interface ILanguageRepository {
  getLanguagesByUserId(userId: ObjectId): Promise<Language[]>;
  getLanguageById(id: ObjectId): Promise<Language | null>;
  addLanguage(language: Language): Promise<Language>;
  updateLanguage(id: ObjectId, language: Partial<Language>): Promise<boolean>;
  deleteLanguage(id: ObjectId): Promise<boolean>;
}
