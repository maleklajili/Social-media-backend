import { spawn } from "child_process";
import { resolve, join } from "path";
import { existsSync } from "fs";

const PYTHON_SCRIPT = resolve(
  import.meta.dir,
  "../../python-ai/render_cv_pdf.py",
);

const UPLOADS_DIR = resolve(import.meta.dir, "../../uploads");

export class CvPdfRenderer {
  /**
   * Resolve a user.image value (relative URL or path) to an absolute local file path.
   * Returns empty string if the file cannot be found.
   */
  private static resolvePhotoPath(photoUrl: string): string {
    if (!photoUrl) return "";

    // If it's already an absolute path that exists, use it
    if (existsSync(photoUrl)) return photoUrl;

    // Strip leading slash if present (e.g., "/uploads/images/xxx.jpg")
    const relative = photoUrl.startsWith("/") ? photoUrl.slice(1) : photoUrl;

    // If it starts with "uploads/", resolve from project root
    if (relative.startsWith("uploads/")) {
      const absPath = resolve(import.meta.dir, "../../", relative);
      if (existsSync(absPath)) return absPath;
    }

    // Try directly under uploads dir
    const directPath = join(UPLOADS_DIR, relative.replace(/^uploads\/?/, ""));
    if (existsSync(directPath)) return directPath;

    // Try just the filename in images folder
    const filename = photoUrl.split("/").pop() || "";
    const imagesPath = join(UPLOADS_DIR, "images", filename);
    if (existsSync(imagesPath)) return imagesPath;

    return "";
  }

  static async renderPdf(
    content: string,
    format: string = "standard",
    photoUrl: string = "",
  ): Promise<Buffer> {
    const resolvedPhoto = this.resolvePhotoPath(photoUrl);
    return new Promise((resolve, reject) => {
      const py = spawn("python", [PYTHON_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      const input = JSON.stringify({
        content,
        format,
        photoUrl: resolvedPhoto,
      });
      const chunks: Buffer[] = [];
      let stderr = "";

      py.stdout.on("data", (data: Buffer) => {
        chunks.push(data);
      });

      py.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      py.on("close", (code: number | null) => {
        if (code !== 0) {
          let errorMsg = `PDF rendering failed (code ${code})`;
          try {
            const parsed = JSON.parse(stderr);
            if (parsed.error) errorMsg = parsed.error;
          } catch {
            if (stderr) errorMsg += `: ${stderr}`;
          }
          reject(new Error(errorMsg));
          return;
        }

        const pdfBuffer = Buffer.concat(chunks);
        if (pdfBuffer.length === 0) {
          reject(new Error("PDF rendering produced empty output"));
          return;
        }
        resolve(pdfBuffer);
      });

      py.on("error", (err: Error) => {
        reject(
          new Error(
            `Failed to start Python PDF renderer: ${err.message}. Make sure Python, jinja2 and xhtml2pdf are installed.`,
          ),
        );
      });

      py.stdin.write(input);
      py.stdin.end();
    });
  }
}
