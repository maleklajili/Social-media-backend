import { createCorsResponse } from "../utils/cors";
import { Logger } from "./logger";

// Valid 1x1 transparent PNG decoded from base64 — fallback for missing images
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRU5ErkJggg==",
  "base64",
);

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
]);

function isImagePath(pathname: string): boolean {
  const dot = pathname.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(pathname.substring(dot).toLowerCase());
}

export async function handleUploadsRequest(url: URL): Promise<Response | null> {
  // Only handle requests to the /uploads/ path
  if (!url.pathname.startsWith("/uploads/")) return null;

  const filePath = `.${url.pathname}`;
  const file = Bun.file(filePath);

  const exists = await file.exists();
  if (exists) {
    const response = new Response(file);
    Logger.logHttp("GET", response.status, url.pathname);
    return createCorsResponse(response, true);
  }

  // For missing image files, return a transparent 1x1 PNG instead of 404
  // This prevents NetworkImageLoadException in Flutter clients
  if (isImagePath(url.pathname)) {
    Logger.logHttp("GET", 200, `${url.pathname} (placeholder)`);
    return createCorsResponse(
      new Response(TRANSPARENT_PNG, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache",
        },
      }),
      true,
    );
  }

  Logger.logHttp("GET", 404, url.pathname);
  return new Response("File not found", { status: 404 });
}
