import type { VarRecord } from '@envscan/scanner-core';
import { VercelClient } from './client.js';

interface VercelProject { id: string; name: string; }
interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination?: { next: number | null };
}
interface VercelEnvVar {
  id: string; key: string; value?: string;
  type: 'plain' | 'encrypted' | 'sensitive' | 'system' | 'secret';
  target?: string[]; createdAt?: number; updatedAt?: number;
  comment?: string; configurationId?: string | null;
}
interface VercelEnvResponse { envs: VercelEnvVar[]; }

export interface EnumerateOptions {
  token: string;
  teamId?: string;
  onProgress?: (msg: string, pct: number) => void;
}

export async function enumerateVercel(opts: EnumerateOptions): Promise<{
  records: VarRecord[];
  integrations: { github: boolean; linear: boolean; other: string[] };
}> {
  const client = new VercelClient(opts.token, opts.teamId);

  // 1) list projects (paginated)
  const projects: VercelProject[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.get<VercelProjectsResponse>('/v9/projects', {
      limit: '100', until: cursor,
    });
    projects.push(...res.projects);
    cursor = res.pagination?.next ? String(res.pagination.next) : undefined;
  } while (cursor);

  opts.onProgress?.(`Found ${projects.length} projects`, 10);

  // 2) list env vars per project
  const records: VarRecord[] = [];
  let done = 0;

  for (const p of projects) {
    const res = await client.get<VercelEnvResponse>(`/v10/projects/${p.id}/env`, { decrypt: 'true' });
    for (const e of res.envs) {
      records.push({
        id: e.id, key: e.key,
        value: e.type === 'sensitive' ? null : (e.value ?? null),
        providerType: e.type,
        readableByAttacker: e.type !== 'sensitive',
        targets: e.target ?? [],
        projectId: p.id, projectName: p.name,
        createdAt: e.createdAt, updatedAt: e.updatedAt, comment: e.comment,
      });
    }
    done++;
    opts.onProgress?.(`Scanned ${p.name}`, 10 + Math.round((done / projects.length) * 85));
  }

  const integrations = await detectIntegrations(client);
  opts.onProgress?.('Done', 100);
  return { records, integrations };
}

async function detectIntegrations(client: VercelClient) {
  try {
    const res = await client.get<{ configurations: Array<{ slug: string }> }>(
      '/v1/integrations/configurations', {},
    );
    const slugs = new Set(res.configurations.map(c => c.slug.toLowerCase()));
    return {
      github: slugs.has('github') || slugs.has('vercel-github'),
      linear: slugs.has('linear'),
      other: [...slugs].filter(s => s !== 'github' && s !== 'linear'),
    };
  } catch {
    return { github: false, linear: false, other: [] };
  }
}
