import { ObjectId } from "mongodb";
import { BaseService } from "../base/base-service";
import type { Language } from "../../models/skills/language";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { ILanguageRepository } from "../../interfaces/skills/i-language-repository";
import type { ILanguageService } from "../../interfaces/skills/i-language-service";
import { ResponseHelper } from "../../utils/response-helper";
import type { IUserRepository } from "../../interfaces/user/i-user-repository";
import { COINS_CONFIG } from "../../utils/coins-config";

export class LanguageService
  extends BaseService<Language>
  implements ILanguageService
{
  constructor(
    private languageRepository: ILanguageRepository,
    private userRepository: IUserRepository,
  ) {
    super(CollectionsManager.languageCollection);
  }

  async getLanguagesByUser(userId: ObjectId): Promise<Response> {
    try {
      const languages =
        await this.languageRepository.getLanguagesByUserId(userId);
      return ResponseHelper.success(languages);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async addLanguage(
    userId: ObjectId,
    languageData: Partial<Language>,
  ): Promise<Response> {
    try {
      // Validation
      if (!languageData.name || !languageData.code) {
        return ResponseHelper.error("Nom et code sont requis");
      }

      const language: Language = {
        userId,
        code: languageData.code,
        name: languageData.name,
        nativeName: languageData.nativeName || "",
        level: languageData.level || "Intermédiaire (B1)",
        proficiency: languageData.proficiency || 50,
        flag: languageData.flag,
        fluency: languageData.fluency || "Fluent",
        reading: languageData.reading || 50,
        writing: languageData.writing || 50,
        speaking: languageData.speaking || 50,
        listening: languageData.listening || 50,
        accent: languageData.accent,
        lastPractice: languageData.lastPractice || "Occasionnel",
        contexts: languageData.contexts || [],
      };

      const createdLanguage =
        await this.languageRepository.addLanguage(language);
      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.ADD_LANGUAGE);
      } catch (err) {
        return ResponseHelper.serverError(`error add coins ${String(err)}`);
      }
      return ResponseHelper.success(createdLanguage);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateLanguage(
    userId: ObjectId,
    languageId: ObjectId,
    languageData: Partial<Language>,
  ): Promise<Response> {
    try {
      const existingLanguage =
        await this.languageRepository.getLanguageById(languageId);
      if (!existingLanguage || !existingLanguage.userId.equals(userId)) {
        return ResponseHelper.error("Langue non trouvée ou accès refusé");
      }

      const updated = await this.languageRepository.updateLanguage(
        languageId,
        languageData,
      );
      if (!updated) {
        return ResponseHelper.error("Échec de la mise à jour");
      }

      return ResponseHelper.success(languageData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteLanguage(
    userId: ObjectId,
    languageId: ObjectId,
  ): Promise<Response> {
    try {
      const existingLanguage =
        await this.languageRepository.getLanguageById(languageId);
      if (!existingLanguage || !existingLanguage.userId.equals(userId)) {
        return ResponseHelper.error("Langue non trouvée ou accès refusé");
      }
      try {
        await this.userRepository.removeCoins(
          userId,
          COINS_CONFIG.REMOVE_LANGUAGE,
        );
      } catch (err) {
        console.error("❌ Erreur lors de la suppression des coins:", err);
        // Ne pas retourner une erreur ici - continuer la suppression
      }
      const deleted = await this.languageRepository.deleteLanguage(languageId);
      if (!deleted) {
        return ResponseHelper.error("Échec de la suppression");
      }

      return ResponseHelper.success({
        message: "Langue supprimée avec succès",
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getLanguageById(languageId: ObjectId): Promise<Response> {
    try {
      const language =
        await this.languageRepository.getLanguageById(languageId);
      if (!language) {
        return ResponseHelper.error("Langue non trouvée");
      }
      return ResponseHelper.success(language);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
