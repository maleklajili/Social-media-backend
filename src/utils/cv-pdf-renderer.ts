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
  private static resolvePhotoPath(photoUrl: string, userId?: string): string {
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

    // Try user-specific folder: uploads/images-{userId}/{filename}
    const filename = photoUrl.split("/").pop() || "";
    if (userId && filename) {
      const userImagesPath = join(UPLOADS_DIR, `images-${userId}`, filename);
      if (existsSync(userImagesPath)) return userImagesPath;
    }

    // Try generic images folder
    if (filename) {
      const imagesPath = join(UPLOADS_DIR, "images", filename);
      if (existsSync(imagesPath)) return imagesPath;
    }

    return "";
  }

  static async renderPdf(
    content: string,
    format: string = "standard",
    photoUrl: string = "",
    userName: string = "",
    userTitle: string = "",
    userId?: string,
    primaryColor?: string,
    accentColor?: string,
    userEmail?: string,
    userPhone?: string,
    userAddress?: string,
    userWebsite?: string,
    fontFamily?: string,
    lang?: string,
  ): Promise<Buffer> {
    const resolvedPhoto = this.resolvePhotoPath(photoUrl, userId);
    return new Promise((resolve, reject) => {
      const py = spawn("python", [PYTHON_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      const input = JSON.stringify({
        content,
        format,
        photoUrl: resolvedPhoto,
        userName,
        userTitle,
        userEmail: userEmail || "",
        userPhone: userPhone || "",
        userAddress: userAddress || "",
        userWebsite: userWebsite || "",
        primaryColor: primaryColor || "",
        accentColor: accentColor || "",
        fontFamily: fontFamily || "",
        lang: lang || "fr",
      });
      const chunks: Buffer[] = [];
      let stderr = "";
      let killed = false;

      // Timeout: kill process after 30 seconds
      const timeout = setTimeout(() => {
        killed = true;
        py.kill("SIGKILL");
        reject(new Error("PDF rendering timed out after 30s"));
      }, 30_000);

      py.stdout.on("data", (data: Buffer) => {
        chunks.push(data);
      });

      py.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      py.on("close", (code: number | null) => {
        clearTimeout(timeout);
        if (killed) return;
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
