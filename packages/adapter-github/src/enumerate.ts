import type { ScanFailure, VarRecord } from "@envscan/scanner-core";
import { GitHubClient } from "./client.js";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
}

interface GitHubSecret {
  name: string;
  created_at: string;
  updated_at: string;
}

interface GitHubSecretsResponse {
  total_count: number;
  secrets: GitHubSecret[];
}

export interface EnumerateOptions {
  token: string;
  onProgress?: (msg: string, pct: number) => void;
}

export async function enumerateGitHub(opts: EnumerateOptions): Promise<{
  records: VarRecord[];
  integrations: { github: boolean; linear: boolean; other: string[] };
  failures: ScanFailure[];
}> {
  const client = new GitHubClient(opts.token);
  const records: VarRecord[] = [];
  const integrations = { github: true, linear: false, other: [] as string[] };
  const failures: ScanFailure[] = [];

  opts.onProgress?.("Fetching repositories...", 10);

  let repos: GitHubRepo[] = [];
  try {
    // List user repositories
    repos = await client.get<GitHubRepo[]>("/user/repos", {
      per_page: "100",
      sort: "updated",
    });
  } catch (err) {
    failures.push({
      scope: "projects",
      context: "User repositories",
      message: err instanceof Error ? err.message : "Failed to list repositories",
    });
    return { records, integrations, failures };
  }

  let done = 0;
  for (const repo of repos) {
    try {
      opts.onProgress?.(
        `Scanning secrets in ${repo.full_name}...`,
        10 + Math.round((done / repos.length) * 85),
      );

      const res = await client.get<GitHubSecretsResponse>(
        `/repos/${repo.owner.login}/${repo.name}/actions/secrets`,
      );

      for (const s of res.secrets) {
        records.push({
          id: `${repo.id}-${s.name}`,
          key: s.name,
          value: null, // GitHub secrets are never readable via API
          providerType: "secret",
          readableByAttacker: false, // In GitHub, secrets are encrypted at rest
          targets: ["actions"],
          projectId: String(repo.id),
          projectName: repo.full_name,
          createdAt: new Date(s.created_at).getTime(),
          updatedAt: new Date(s.updated_at).getTime(),
        });
      }
    } catch (err) {
        // Some repos might not have actions enabled or permission denied
        // We log as failure but continue
        failures.push({
            scope: "project-envs",
            context: repo.full_name,
            message: err instanceof Error ? err.message : "Failed to list secrets",
        });
    }
    done++;
  }

  opts.onProgress?.("Done", 100);
  return { records, integrations, failures };
}
