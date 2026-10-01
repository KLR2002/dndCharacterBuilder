import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_CONFIG, ScraperConfig } from "./config.js";

const execFileAsync = promisify(execFile);

export class ToolsClient {
  private config: ScraperConfig;
  private lastRequestTime = 0;

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.useCache && !fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
  }

  private getCachePath(endpoint: string): string {
    const sanitized = endpoint
      .replace(/^https?:\/\/[^/]+\//, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.config.cacheDir, `${sanitized}.json`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.config.requestDelayMs) {
      await this.sleep(this.config.requestDelayMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  public async fetchJson<T>(endpoint: string, forceNetwork = false): Promise<T> {
    const fullUrl = endpoint.startsWith("http")
      ? endpoint
      : `${this.config.baseUrl}/${endpoint.replace(/^\//, "")}`;

    const cacheFile = this.getCachePath(endpoint);

    // Check disk cache first if enabled and not forced
    if (this.config.useCache && !forceNetwork && fs.existsSync(cacheFile)) {
      try {
        const raw = fs.readFileSync(cacheFile, "utf8");
        return JSON.parse(raw) as T;
      } catch {
        // Cache corrupted, re-fetch
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.rateLimit();

        const { stdout, stderr } = await execFileAsync(
          "curl",
          [
            "-s",
            "--fail",
            "-L",
            "--connect-timeout",
            String(Math.floor(this.config.timeoutMs / 1000)),
            "-A",
            this.config.userAgent,
            "-H",
            "Accept: application/json, text/plain, */*",
            "-H",
            "Accept-Language: en-US,en;q=0.9",
            fullUrl,
          ],
          { maxBuffer: 100 * 1024 * 1024 }
        );

        if (!stdout || stdout.trim().length === 0) {
          throw new Error(`Empty response from ${fullUrl}. Stderr: ${stderr}`);
        }

        const data = JSON.parse(stdout) as T;

        if (this.config.useCache) {
          fs.writeFileSync(cacheFile, JSON.stringify(data), "utf8");
        }

        return data;
      } catch (err: any) {
        lastError = err;
        const delay = attempt * 1000;
        if (attempt < this.config.maxRetries) {
          console.warn(
            `[WARN] Attempt ${attempt} failed for ${fullUrl} (${err.message}). Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to fetch ${fullUrl} after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }
}
