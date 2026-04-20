const BASE = "https://api.vercel.com";

export class VercelApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class VercelClient {
  constructor(
    private token: string,
    private teamId?: string,
  ) {}

  setTeamId(id?: string) {
    this.teamId = id;
  }

  async get<T>(
    path: string,
    query: Record<string, string | undefined> = {},
  ): Promise<T> {
    const qs = new URLSearchParams();
    if (this.teamId) qs.set("teamId", this.teamId);
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
        throw new VercelApiError(
          res.status,
          body?.error?.code ?? "unknown",
          body?.error?.message ?? res.statusText,
        );
      }
      return res.json() as Promise<T>;
    }
    throw new VercelApiError(429, "rate_limited", "Too many requests");
  }
}
