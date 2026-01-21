import fs from "fs/promises";
import path from "path";
import { UPLOAD_PATHS } from "../config/config";
import type { Certification } from "../models/certifications";
import type { PostMedia } from "../models/post";

export class FileService {
  /**
   * Supprime un fichier physique du système de fichiers
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.warn(`⚠️ Fichier non trouvé (déjà supprimé?): ${filePath}`);
      } else {
        console.error(
          `❌ Erreur lors de la suppression de ${filePath}:`,
          error,
        );
        throw error;
      }
    }
  }

  /**
   * Supprime un fichier de certification
   */
  static async deleteCertificationFile(
    fileName: string,
    userId: string,
  ): Promise<void> {
    try {
      if (!fileName || fileName.trim() === "") {
        console.warn(`⚠️ Nom de fichier vide pour userId: ${userId}`);
        return;
      }

      const basePath = process.cwd();
      // CORRECTION: Utiliser le bon chemin avec le tiret
      const fullPath = path.join(
        basePath,
        "uploads", // Début du chemin
        `images-${userId}`, // Dossier utilisateur AVEC "images-"
        UPLOAD_PATHS.cerifications, // Sous-dossier certifications
        fileName,
      );

      await this.deleteFile(fullPath);
    } catch (error) {
      console.error(
        `❌ Erreur lors de la suppression du fichier de certification ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Supprime plusieurs fichiers de certification
   */
  static async deleteMultipleCertificationFiles(
    certifications: Certification[],
    userId: string,
  ): Promise<void> {
    try {
      if (!certifications || certifications.length === 0) {
        console.log("ℹ️ Aucune certification à supprimer");
        return;
      }

      const deletePromises = certifications
        .filter((cert) => cert.file && cert.file.trim() !== "")
        .map((cert) => this.deleteCertificationFile(cert.file!, userId));

      if (deletePromises.length === 0) {
        console.log("ℹ️ Aucun fichier physique à supprimer");
        return;
      }
    } catch (error) {
      console.error(
        "❌ Erreur lors de la suppression multiple des fichiers:",
        error,
      );
      throw error;
    }
  }
  /**
   * Supprime un fichier de post (image ou vidéo)
   */
  static async deletePostFile(
    fileName: string,
    userId: string,
    mediaType: "image" | "video" | "document" = "image",
  ): Promise<void> {
    try {
      if (!fileName || fileName.trim() === "") {
        console.warn(`⚠️ Nom de fichier vide pour userId: ${userId}`);
        return;
      }

      const basePath = process.cwd();
      const folder = mediaType === "image" ? "images" : "videos";
      const fullPath = path.join(
        basePath,
        "uploads",
        `${folder}-${userId}`,
        UPLOAD_PATHS.posts,
        fileName,
      );

      await this.deleteFile(fullPath);
      console.log(`✅ Fichier de post supprimé: ${fileName}`);
    } catch (error) {
      console.error(
        `❌ Erreur lors de la suppression du fichier de post ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Supprime plusieurs fichiers de posts
   */
  static async deleteMultiplePostFiles(
    mediaItems: PostMedia[],
    userId: string,
  ): Promise<void> {
    try {
      if (!mediaItems || mediaItems.length === 0) {
        console.log("ℹ️ Aucun média de post à supprimer");
        return;
      }

      const deletePromises = mediaItems
        .filter((media) => media.url && media.url.trim() !== "")
        .map((media) => {
          const fileName = this.extractFileNameFromUrl(media.url);
          return this.deletePostFile(fileName, userId, media.type);
        });

      if (deletePromises.length === 0) {
        console.log("ℹ️ Aucun fichier physique à supprimer");
        return;
      }

      await Promise.all(deletePromises);
      console.log(`✅ ${deletePromises.length} fichiers de post supprimés`);
    } catch (error) {
      console.error(
        "❌ Erreur lors de la suppression multiple des fichiers de post:",
        error,
      );
      throw error;
    }
  }
  /**
   * Supprime plusieurs fichiers depuis des URLs
   */
  static async deleteMultipleFiles(
    urls: string[],
    userId: string,
  ): Promise<void> {
    try {
      if (!urls || urls.length === 0) {
        console.log("ℹ️ Aucune URL à supprimer");
        return;
      }

      const deletePromises = urls
        .filter((url) => url && url.trim() !== "")
        .map((url) => {
          const fileName = this.extractFileNameFromUrl(url);
          // Déterminer le type de média basé sur l'extension
          const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(fileName);
          return this.deletePostFile(
            fileName,
            userId,
            isVideo ? "video" : "image",
          );
        });

      if (deletePromises.length === 0) {
        console.log("ℹ️ Aucun fichier physique à supprimer");
        return;
      }

      await Promise.all(deletePromises);
      console.log(`✅ ${deletePromises.length} fichiers supprimés`);
    } catch (error) {
      console.error(
        "❌ Erreur lors de la suppression multiple des fichiers:",
        error,
      );
      throw error;
    }
  }
  /**
   * Nettoie le dossier des certifications vides
   */
  static async cleanEmptyCertificationDirectory(userId: string): Promise<void> {
    try {
      // CORRECTION: Chemin correct pour le dossier
      const userCertDir = path.join(
        process.cwd(),
        "uploads",
        `images-${userId}`,
        UPLOAD_PATHS.cerifications,
      );

      await fs.readdir(userCertDir, { withFileTypes: true });

      /*      if (files.length === 0) {
        await fs.rmdir(userCertDir);
      } else {
        console.log(`📁 Dossier non vide (${files.length} fichiers), pas de suppression`);
      } */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log(`ℹ️ Dossier non trouvé (déjà supprimé?): ${error.path}`);
      } else {
        console.warn(`⚠️ Impossible de nettoyer le dossier:`, error);
      }
    }
  }
  /**
   * Extrait le nom du fichier depuis une URL
   */
  private static extractFileNameFromUrl(url: string): string {
    if (!url) return "";

    // Si c'est une URL complète, extraire le chemin
    try {
      const urlObj = new URL(url);
      return path.basename(urlObj.pathname);
    } catch {
      // Si ce n'est pas une URL valide, traiter comme un chemin local
      return path.basename(url);
    }
  }

  /**
   * Vérifie si un fichier existe
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère la taille d'un fichier
   */
  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error(
        `❌ Erreur lors de la lecture de la taille du fichier ${filePath}:`,
        error,
      );
      throw error;
    }
  }
}
