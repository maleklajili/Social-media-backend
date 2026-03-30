import { spawn } from "child_process";
import { resolve } from "path";
import { EnvLoader } from "../config/env";

const PYTHON_SCRIPT = resolve(
  import.meta.dir,
  "../../python-ai/generate_cv.py",
);

export class HuggingFaceClient {
  static async generateText(
    prompt: string,
    format: string = "default",
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const py = spawn("python", [PYTHON_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      const input = JSON.stringify({
        prompt,
        model: EnvLoader.ollamaModel,
        format,
      });
      let stdout = "";
      let stderr = "";

      py.stdout.on("data", (data: Buffer) => {
        stdout += data.toString("utf8");
      });

      py.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      py.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(
            new Error(
              `Python AI script failed (code ${code}): ${stderr || stdout}`,
            ),
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(`Ollama error: ${result.error}`));
            return;
          }
          resolve(result.text || "");
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      py.on("error", (err: Error) => {
        reject(
          new Error(
            `Failed to start Python script: ${err.message}. Make sure Python is installed and 'ollama' package is available (pip install ollama).`,
          ),
        );
      });

      py.stdin.write(input);
      py.stdin.end();
    });
  }
}
