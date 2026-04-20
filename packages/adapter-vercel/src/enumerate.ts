import type { ScanFailure, VarRecord } from "@envscan/scanner-core";
import { VercelClient } from "./client.js";

interface VercelProject {
  id: string;
  name: string;
}
interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination?: { next: number | null };
}
interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  type: "plain" | "encrypted" | "sensitive" | "system" | "secret";
  target?: string[];
  createdAt?: number;
  updatedAt?: number;
  comment?: string;
  configurationId?: string | null;
}
interface VercelEnvResponse {
  envs: VercelEnvVar[];
}
type VercelSingleEnvResponse = VercelEnvVar;

interface VercelTeam {
  id: string;
  name: string;
  slug: string;
}
interface VercelTeamsResponse {
  teams: VercelTeam[];
  pagination?: { next: number | null };
}

export interface EnumerateOptions {
  token: string;
  teamId?: string;
  onProgress?: (msg: string, pct: number) => void;
}

export async function scanSingleVar(opts: {
  token: string;
  teamId?: string;
  projectId: string;
  envId: string;
}): Promise<VarRecord> {
  const client = new VercelClient(opts.token, opts.teamId);
  const res = await client.get<VercelSingleEnvResponse>(
    `/v10/projects/${opts.projectId}/env/${opts.envId}`,
    { decrypt: "true" },
  );
  const e = res;

  // Need project name too, but we might not have it easily here without another call
  // For verification, we mainly care about the value/type
  return {
    id: e.id,
    key: e.key,
    value: e.type === "sensitive" ? null : (e.value ?? null),
    providerType: e.type,
    readableByAttacker: e.type !== "sensitive",
    targets: e.target ?? [],
    projectId: opts.projectId,
    projectName: "Unknown",
    teamId: opts.teamId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    comment: e.comment,
  };
}

export async function enumerateVercel(opts: EnumerateOptions): Promise<{
  records: VarRecord[];
  integrations: { github: boolean; linear: boolean; other: string[] };
  failures: ScanFailure[];
}> {
  const client = new VercelClient(opts.token, opts.teamId);
  const records: VarRecord[] = [];
  const integrations = { github: false, linear: false, other: [] as string[] };
  const failures: ScanFailure[] = [];

  const contexts: Array<{ id?: string; name: string }> = [];

  if (opts.teamId) {
    contexts.push({ id: opts.teamId, name: "Specified Team" });
  } else {
    opts.onProgress?.("Fetching accessible teams...", 5);
    try {
      // 1) List teams
      let cursor: string | undefined;
      do {
        const res = await client.get<VercelTeamsResponse>("/v2/teams", {
          until: cursor,
        });
        contexts.push(
          ...res.teams.map((t) => ({ id: t.id, name: t.name || t.slug })),
        );
        cursor = res.pagination?.next ? String(res.pagination.next) : undefined;
      } while (cursor);

      // 2) Add personal account (no teamId)
      contexts.unshift({ id: undefined, name: "Personal Account" });
    } catch (err) {
      failures.push({
        scope: "teams",
        context: "Accessible teams",
        message: err instanceof Error ? err.message : "Failed to list teams",
      });
      // If team fetch fails, fallback to just personal account
      contexts.push({ id: undefined, name: "Personal Account" });
    }
  }

  let currentContextIdx = 0;
  for (const context of contexts) {
    const contextPctBase = (currentContextIdx / contexts.length) * 100;
    const contextPctWeight = 1 / contexts.length;

    client.setTeamId(context.id);
    opts.onProgress?.(
      `Scanning ${context.name}...`,
      Math.round(contextPctBase + 2),
    );

    // 1) list projects
    const projects: VercelProject[] = [];
    let cursor: string | undefined;
    try {
      do {
        const res = await client.get<VercelProjectsResponse>("/v9/projects", {
          limit: "100",
          until: cursor,
        });
        projects.push(...res.projects);
        cursor = res.pagination?.next ? String(res.pagination.next) : undefined;
      } while (cursor);
    } catch (err) {
      failures.push({
        scope: "projects",
        context: context.name,
        message: err instanceof Error ? err.message : "Failed to list projects",
      });
      continue;
    }

    // 2) list env vars per project
    let done = 0;
    for (const p of projects) {
      try {
        const res = await client.get<VercelEnvResponse>(
          `/v10/projects/${p.id}/env`,
          { decrypt: "true" },
        );
        for (const e of res.envs) {
          records.push({
            id: e.id,
            key: e.key,
            value: e.type === "sensitive" ? null : (e.value ?? null),
            providerType: e.type,
            readableByAttacker: e.type !== "sensitive",
            targets: e.target ?? [],
            projectId: p.id,
            projectName: p.name,
            teamId: context.id,
            teamName: context.name,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
            comment: e.comment,
          });
        }
      } catch (err) {
        failures.push({
          scope: "project-envs",
          context: `${context.name} / ${p.name}`,
          message:
            err instanceof Error
              ? err.message
              : "Failed to retrieve environment variables",
        });
      }
      done++;
      opts.onProgress?.(
        `Scanned ${context.name} / ${p.name}`,
        Math.round(
          contextPctBase + (done / projects.length) * 80 * contextPctWeight,
        ),
      );
    }

    // 3) detect integrations for this context
    const contextIntegrations = await detectIntegrations(
      client,
      context.name,
      failures,
    );
    integrations.github = integrations.github || contextIntegrations.github;
    integrations.linear = integrations.linear || contextIntegrations.linear;
    integrations.other = Array.from(
      new Set([...integrations.other, ...contextIntegrations.other]),
    );

    currentContextIdx++;
  }

  opts.onProgress?.("Done", 100);
  return { records, integrations, failures };
}

async function detectIntegrations(
  client: VercelClient,
  contextName: string,
  failures: ScanFailure[],
) {
  try {
    const res = await client.get<{ configurations: Array<{ slug: string }> }>(
      "/v1/integrations/configurations",
      {},
    );
    const slugs = new Set(res.configurations.map((c) => c.slug.toLowerCase()));
    return {
      github: slugs.has("github") || slugs.has("vercel-github"),
      linear: slugs.has("linear"),
      other: [...slugs].filter((s) => s !== "github" && s !== "linear"),
    };
  } catch (err) {
    failures.push({
      scope: "integrations",
      context: contextName,
      message:
        err instanceof Error ? err.message : "Failed to detect integrations",
    });
    return { github: false, linear: false, other: [] };
  }
}
