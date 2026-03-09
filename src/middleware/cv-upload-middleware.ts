import { mkdir } from "fs/promises";
import { join } from "path";
import { Logger } from "../config/logger";

interface CVUploadData {
  cvFile?: {
    name: string;
  };
  coverLetter?: string;
}

/**
 * Middleware to handle CV file uploads for job applications
 * Handles multipart/form-data with file upload
 * Stores CV in uploads/user-{userId}/cv/
 */
export async function cvUploadMiddleware(
  req: unknown,
  userId: string,
): Promise<{ cvData: CVUploadData; formData: unknown }> {
  const cvData: CVUploadData = {};

  try {
    const request = req as Request;
    const formData = await request.formData();
    const coverLetter = formData.get("coverLetter") as string | null;

    if (coverLetter) {
      cvData.coverLetter = coverLetter;
    }

    // Get CV file if provided
    const cvFile = formData.get("cv") as File | null;

    if (cvFile && cvFile.size > 0) {
      // Validate file type (only PDF, DOC, DOCX allowed)
      const allowedMimeTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedMimeTypes.includes(cvFile.type)) {
        throw new Error(
          "Invalid file type. Only PDF, DOC, and DOCX files are allowed.",
        );
      }

      // Validate file size (max 5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
      if (cvFile.size > maxFileSize) {
        throw new Error(
          `File size exceeds maximum limit of 5MB. Your file is ${(cvFile.size / 1024 / 1024).toFixed(2)}MB.`,
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = getFileExtension(cvFile.type);
      const filename = `cv-${timestamp}${extension}`;
      const uploadDir = `./uploads/images-${userId}/cv`;
      const filepath = join(uploadDir, filename);

      // Create directory if it doesn't exist
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (err) {
        Logger.error(`Error creating upload directory: ${err}`);
      }

      // Save file
      const arrayBuffer = await cvFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await Bun.write(filepath, buffer);

      Logger.info(`CV file uploaded: ${filename}`);

      cvData.cvFile = {
        name: filename,
      };
    }

    return { cvData, formData };
  } catch (err) {
    Logger.error(`Error processing CV upload: ${err}`);
    throw err;
  }
}

/**
 * Get file extension based on MIME type
 */
function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
  };
  return extensions[mimeType] || ".pdf";
}

/**
 * Delete CV file from disk
 */
export async function deleteCVFile(filepath: string): Promise<void> {
  try {
    const file = Bun.file(filepath);
    if (await file.exists()) {
      await Bun.write(filepath, ""); // Clear file
      Logger.info(`CV file deleted: ${filepath}`);
    }
  } catch (err) {
    Logger.error(`Error deleting CV file: ${err}`);
  }
}

/**
 * Validate if CV file exists
 */
export async function validateCVFileExists(filepath: string): Promise<boolean> {
  try {
    const file = Bun.file(filepath);
    return await file.exists();
  } catch (err) {
    Logger.error(`Error validating CV file: ${err}`);
    return false;
  }
}
