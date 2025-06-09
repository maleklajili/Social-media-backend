import { readdir } from "node:fs/promises";
import { UPLOAD_PATHS } from "../src/config/config";
import { ConnectionDatabase } from "../src/config/connection-database";
import { EnvLoader } from "../src/config/env";
import { Logger } from "../src/config/logger";
import { CollectionsManager } from "../src/models/base/collection-manager";

const DEFAULT_MAX_STORAGE = 1 * 1024 * 1024 * 1024; // 1 GB

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

async function calculateDirectorySize(dir: string): Promise<number> {
  let total = 0;

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${dir.replace(/\/+$/, "")}/${entry.name}`;

      if (entry.isDirectory()) {
        total += await calculateDirectorySize(fullPath);
      } else {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          // Read the file buffer to get size
          const buffer = await file.arrayBuffer();
          total += buffer.byteLength;
        }
      }
    }
  } catch (err) {
    Logger.error(`Error reading directory ${dir}: ${err}`);
  }

  return total;
}

async function updateAllUserStorage() {
  try {
    await ConnectionDatabase.connect(EnvLoader.uri);

    const usersCollection = CollectionsManager.userCollection;
    const storageCollection = CollectionsManager.userStrorageCollection;

    if (!usersCollection || !storageCollection) {
      throw new Error("Collections not initialized.");
    }

    const users = await usersCollection
      .find({}, { projection: { _id: 1 } })
      .toArray();

    for (const user of users) {
      const userId = user._id.toString();
      const uploadPath = `${process.cwd()}/${UPLOAD_PATHS.images}-${userId}`;

      const usedStorage = await calculateDirectorySize(uploadPath);
      const readableSize = formatBytes(usedStorage);

      await storageCollection.updateOne(
        { userId: user._id },
        {
          $set: {
            usedStorage,
            readableSize,
            maxStorage: DEFAULT_MAX_STORAGE,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      Logger.info(`Updated ${userId}: ${readableSize}`);
    }

    Logger.success("All users processed.");
  } catch (err) {
    Logger.error(`Failed to update user storage: ${err}`, true);
  }
}

updateAllUserStorage();
