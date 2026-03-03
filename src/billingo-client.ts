const BASE_URL = "https://api.billingo.hu/v3";

export class BillingoApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Billingo API error ${status}: ${JSON.stringify(body)}`);
    this.name = "BillingoApiError";
  }
}

export class BillingoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown> {
    const url = new URL(`${BASE_URL}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      "X-API-KEY": this.apiKey,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new BillingoApiError(res.status, errorBody);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return res.json();
    }

    return res.text();
  }

  async requestBinary(
    method: string,
    path: string,
    accept: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: accept,
      },
    });
    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new BillingoApiError(res.status, errorBody);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf, contentType: res.headers.get("content-type") ?? accept };
  }

  get(path: string, query?: Record<string, string | number | boolean | undefined>) {
    return this.request("GET", path, undefined, query);
  }

  post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }

  put(path: string, body?: unknown) {
    return this.request("PUT", path, body);
  }

  delete(path: string) {
    return this.request("DELETE", path);
  }
}
