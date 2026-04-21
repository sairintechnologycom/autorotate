const BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  status: number;
  code: string;
  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class GitHubClient {
  constructor(
    private token: string,
  ) {}

  async get<T>(
    path: string,
    query: Record<string, string | undefined> = {},
  ): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
    const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        headers: { 
            Authorization: `Bearer ${this.token}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        },
      });
      if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
        const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0);
        const wait = Math.max(0, reset * 1000 - Date.now()) + 1000;
        if (wait < 30000) { // Only wait if it's less than 30s
            await new Promise((r) => setTimeout(r, wait));
            continue;
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new GitHubApiError(
            res.status,
            body?.message ?? "unknown",
            body?.message ?? res.statusText,
        );
      }
      return res.json() as Promise<T>;
    }
    throw new GitHubApiError(429, "rate_limited", "Too many requests or rate limit exceeded");
  }
}
