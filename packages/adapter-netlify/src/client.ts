const BASE = "https://api.netlify.com/api/v1";

export class NetlifyApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NetlifyClient {
  constructor(
    private token: string,
    private accountId?: string,
  ) {}

  setAccountId(id?: string) {
    this.accountId = id;
  }

  async get<T>(
    path: string,
    query: Record<string, string | undefined> = {},
  ): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
    const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.status === 429) {
        const retry = Number(res.headers.get("retry-after") ?? 1);
        await new Promise((r) => setTimeout(r, retry * 1000));
        continue;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new NetlifyApiError(
            res.status,
            body?.error?.code ?? "unknown",
            body?.error?.message ?? res.statusText,
        );
      }
      return res.json() as Promise<T>;
    }
    throw new NetlifyApiError(429, "rate_limited", "Too many requests");
  }
}
