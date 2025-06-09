import { createCorsResponse } from "../utils/cors";
import { Logger } from "./logger";

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

  Logger.logHttp("GET", 404, url.pathname);
  return new Response("File not found", { status: 404 });
}
