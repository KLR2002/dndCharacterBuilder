import * as path from "node:path";

export interface ScraperConfig {
  baseUrl: string;
  fallbackBaseUrl?: string;
  userAgent: string;
  outputDir: string;
  cacheDir: string;
  useCache: boolean;
  requestDelayMs: number;
  maxRetries: number;
  timeoutMs: number;
}

export const DEFAULT_CONFIG: ScraperConfig = {
  baseUrl: "https://2014.5e.tools",
  fallbackBaseUrl: "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master",
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  outputDir: path.resolve(process.cwd(), "data"),
  cacheDir: path.resolve(process.cwd(), ".cache"),
  useCache: true,
  requestDelayMs: 300,
  maxRetries: 3,
  timeoutMs: 30000,
};
