import type { ObjectId } from "mongodb";
import type { Language } from "../../models/skills/language";

export interface ILanguageService {
  getLanguagesByUser(userId: ObjectId): Promise<Response>;
  addLanguage(
    userId: ObjectId,
    languageData: Partial<Language>,
  ): Promise<Response>;
  updateLanguage(
    userId: ObjectId,
    languageId: ObjectId,
    languageData: Partial<Language>,
  ): Promise<Response>;
  deleteLanguage(userId: ObjectId, languageId: ObjectId): Promise<Response>;
  getLanguageById(languageId: ObjectId): Promise<Response>;
}
