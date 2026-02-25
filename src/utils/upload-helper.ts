import { ObjectId } from "mongodb"; // ou mongoose.Types.ObjectId si tu utilises Mongoose
import { syncUserStorageDelta } from "./asyn-user-storage";

export interface UploadResult {
  buffer: Uint8Array;
  fileName: string;
  mimeType: string;
  fullPath?: string;
  size?: number;
  fileType?: string;
}

interface HandleFileUploadOptions {
  fieldName: string;
  storePath: string;
  fileName?: string | ((index: number, originalName: string) => string);
  multiple?: boolean;
  writeToDisk?: boolean;
  userId?: string | ObjectId;
}

// ✅ Type compatible pour Bun / undici
type FormDataEntryValueCompatible = string | File;

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : "";
}
/** */
export async function handleFileUpload(
  formData: FormData,
  options: HandleFileUploadOptions,
): Promise<UploadResult | UploadResult[] | null> {
  const writeToDisk = options.writeToDisk ?? false;
  const userId = options.userId?.toString();
  const basePath = options.storePath.replace(/\/+$/, ""); // Clean trailing slashes

  if (options.multiple === true) {
    const files = formData.getAll(
      options.fieldName,
    ) as FormDataEntryValueCompatible[];
    if (!files.length) return null;

    const results: UploadResult[] = [];
    let totalBytes = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!(file instanceof File)) return null; // ✅ type safe
      if (!file.name?.trim()) return null;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const originalExtension = getExtension(file.name);

      const baseFileName =
        typeof options.fileName === "function"
          ? options.fileName(i, file.name)
          : options.fileName || file.name || `uploaded_file_${i}`;

      const safeFileName = baseFileName.endsWith(originalExtension)
        ? baseFileName
        : `${baseFileName}${i}${originalExtension}`;

      let fullPath: string | undefined;
      if (writeToDisk) {
        fullPath = `${basePath}/${safeFileName}`;
        await Bun.write(fullPath, buffer);
      }

      results.push({
        buffer,
        fileName: safeFileName,
        mimeType: file.type,
        fullPath,
        size: buffer.length,
      });

      totalBytes += buffer.length;
    }

    if (writeToDisk && userId && totalBytes > 0) {
      await syncUserStorageDelta(userId, totalBytes);
    }

    return results;
  } else {
    const file = formData.get(
      options.fieldName,
    ) as FormDataEntryValueCompatible;
    if (!file || !(file instanceof File)) return null; // ✅ type safe
    if (!file.name?.trim()) return null;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const originalExtension = getExtension(file.name);

    const baseFileName =
      typeof options.fileName === "string"
        ? options.fileName
        : file.name || "uploaded_file";

    const safeFileName = baseFileName.endsWith(originalExtension)
      ? baseFileName
      : `${baseFileName}${originalExtension}`;

    let fullPath: string | undefined;
    if (writeToDisk) {
      fullPath = `${basePath}/${safeFileName}`;
      await Bun.write(fullPath, buffer);
    }

    if (writeToDisk && userId && buffer.length > 0) {
      await syncUserStorageDelta(userId, buffer.length);
    }

    return {
      buffer,
      fileName: safeFileName,
      mimeType: file.type,
      fullPath,
      size: buffer.length,
    };
  }
}

export async function deleteFiles(
  paths: string | string[] | undefined,
  basePath: string,
  userId?: string | ObjectId,
): Promise<string[]> {
  if (!paths) return [];

  const cleanedBasePath = basePath.replace(/\/+$/, ""); // Clean trailing slashes
  const fileList = Array.isArray(paths) ? paths : [paths];
  const deleted: string[] = [];
  let totalFreedBytes = 0;

  for (const fileName of fileList) {
    const file = Bun.file(`${cleanedBasePath}/${fileName}`);

    if (await file.exists()) {
      try {
        const fileArrayBuffer = await file.arrayBuffer();
        const fileSize = fileArrayBuffer.byteLength;

        await file.delete();
        deleted.push(fileName);
        totalFreedBytes += fileSize;
      } catch (err) {
        console.error(`Failed to delete ${fileName}:`, err);
      }
    } else {
      console.warn(`File not found: ${fileName}`);
    }
  }

  if (userId && totalFreedBytes > 0) {
    await syncUserStorageDelta(userId, -totalFreedBytes);
  }

  return deleted;
}
