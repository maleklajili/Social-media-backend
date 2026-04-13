import { spawn } from "child_process";
import { resolve } from "path";

const PYTHON_SCRIPT = resolve(
  import.meta.dir,
  "../../python-ai/job_matcher.py",
);

export interface JobWithScore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  matchScore: number;
}

export class JobMatcherClient {
  static async matchJobs(
    profile: Record<string, unknown>,
    jobs: unknown[],
  ): Promise<JobWithScore[]> {
    return new Promise((resolve_fn, reject) => {
      const py = spawn("python", [PYTHON_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      const input = JSON.stringify({ profile, jobs });
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
              `Job matcher Python script failed (code ${code}): ${stderr || stdout}`,
            ),
          );
          return;
        }
        try {
          const result = JSON.parse(stdout);
          resolve_fn(result as JobWithScore[]);
        } catch {
          reject(new Error(`Failed to parse job matcher output: ${stdout}`));
        }
      });

      py.on("error", (err: Error) => {
        reject(
          new Error(
            `Failed to start job matcher script: ${err.message}. Ensure Python is installed.`,
          ),
        );
      });

      py.stdin.write(input);
      py.stdin.end();
    });
  }
}
