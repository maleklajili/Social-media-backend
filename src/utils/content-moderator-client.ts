import { spawn } from "child_process";
import { resolve } from "path";

const PYTHON_SCRIPT = resolve(
  import.meta.dir,
  "../../python-ai/content_moderator.py",
);

export interface ToxicityResult {
  toxic: boolean;
  score: number;
  categories: string[];
  reason: string;
  details?: Record<string, unknown>;
}

export interface FakeUserResult {
  fake: boolean;
  score: number;
  flags: string[];
  reason: string;
}

function runPython<T>(input: Record<string, unknown>): Promise<T> {
  return new Promise((resolve_fn, reject) => {
    const py = spawn("python", [PYTHON_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
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
            `Content moderator failed (code ${code}): ${stderr || stdout}`,
          ),
        );
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(`Moderation error: ${result.error}`));
          return;
        }
        resolve_fn(result as T);
      } catch {
        reject(new Error(`Failed to parse moderator output: ${stdout}`));
      }
    });

    py.on("error", (err: Error) => {
      reject(
        new Error(
          `Failed to start content moderator: ${err.message}. Ensure Python is installed.`,
        ),
      );
    });

    py.stdin.write(JSON.stringify(input));
    py.stdin.end();
  });
}

export class ContentModeratorClient {
  /**
   * Check text for toxicity (insults, hate speech, threats, spam, etc.)
   */
  static async checkToxicity(text: string): Promise<ToxicityResult> {
    return runPython<ToxicityResult>({ action: "check_toxicity", text });
  }

  /**
   * Check if a user profile looks fake/bot-like
   */
  static async checkFakeUser(
    user: Record<string, unknown>,
  ): Promise<FakeUserResult> {
    return runPython<FakeUserResult>({ action: "check_user", user });
  }
}
