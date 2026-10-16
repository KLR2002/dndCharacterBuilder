export interface ScraperProgressCallback {
  (category: string, currentStep: number, totalSteps: number): void;
}

export class BrowserToolsClient {
  private baseUrl: string;

  constructor(baseUrl = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master") {
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
