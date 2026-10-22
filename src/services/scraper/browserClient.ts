export interface ScraperProgressCallback {
  (category: string, currentStep: number, totalSteps: number): void;
}

/** The raw GitHub mirror the in-app sync reads the 5etools data from. */
export const RAW_MIRROR_BASE_URL = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master";

export class BrowserToolsClient {
  private baseUrl: string;

  constructor(baseUrl = RAW_MIRROR_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async fetchJson<T>(endpoint: string): Promise<T> {
    const cleanEndpoint = endpoint.replace(/^\//, "");
    const fullUrl = cleanEndpoint.startsWith("http")
      ? cleanEndpoint
      : `${this.baseUrl}/${cleanEndpoint}`;

    const res = await fetch(fullUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${endpoint} (HTTP ${res.status})`);
    }
    return (await res.json()) as T;
  }
}
