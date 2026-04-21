import type { ScanFailure, VarRecord } from "@envscan/scanner-core";
import { NetlifyClient } from "./client.js";

interface NetlifyAccount {
  id: string;
  name: string;
  slug: string;
}

interface NetlifySite {
  id: string;
  name: string;
  account_slug: string;
  account_id: string;
}

interface NetlifyEnvVar {
  key: string;
  values: Array<{
    id: string;
    context: string;
    value: string;
  }>;
  updated_at: string;
}

export interface EnumerateOptions {
  token: string;
  accountId?: string;
  onProgress?: (msg: string, pct: number) => void;
}

export async function scanSingleVar(opts: {
  token: string;
  accountId: string;
  envId: string;
}): Promise<VarRecord> {
  const client = new NetlifyClient(opts.token, opts.accountId);
  // Netlify env var API returns an array, but we can filter or find the specific ID.
  // Actually, there is an endpoint for a specific key: /accounts/{account_id}/env/{key}
  // But we use UUIDs in records.id.
  const res = await client.get<NetlifyEnvVar[]>(`/accounts/${opts.accountId}/env`);
  const ev = res.find(e => e.values.some(v => v.id === opts.envId));
  
  if (!ev) throw new Error("Environment variable not found");
  const val = ev.values.find(v => v.id === opts.envId)!;

  return {
    id: val.id,
    key: ev.key,
    value: val.value,
    providerType: "plain",
    readableByAttacker: true,
    targets: [val.context],
    projectId: opts.accountId,
    projectName: opts.accountId,
    teamId: opts.accountId,
    teamName: opts.accountId,
    updatedAt: new Date(ev.updated_at).getTime(),
  };
}

export async function enumerateNetlify(opts: EnumerateOptions): Promise<{
  records: VarRecord[];
  integrations: { github: boolean; linear: boolean; other: string[] };
  failures: ScanFailure[];
}> {
  const client = new NetlifyClient(opts.token, opts.accountId);
  const records: VarRecord[] = [];
  const integrations = { github: false, linear: false, other: [] as string[] };
  const failures: ScanFailure[] = [];

  const accounts: NetlifyAccount[] = [];

  if (opts.accountId) {
    accounts.push({ id: opts.accountId, name: "Specified Account", slug: opts.accountId });
  } else {
    opts.onProgress?.("Fetching accessible accounts...", 5);
    try {
      const res = await client.get<NetlifyAccount[]>("/accounts");
      accounts.push(...res);
    } catch (err) {
      failures.push({
        scope: "accounts",
        context: "Accessible accounts",
        message: err instanceof Error ? err.message : "Failed to list accounts",
      });
    }
  }

  let currentAccountIdx = 0;
  for (const account of accounts) {
    const accountPctBase = (currentAccountIdx / accounts.length) * 100;
    const accountPctWeight = 1 / accounts.length;

    client.setAccountId(account.slug);
    opts.onProgress?.(
      `Scanning account ${account.name}...`,
      Math.round(accountPctBase + 2),
    );

    // 1) List sites for this account
    let sites: NetlifySite[] = [];
    try {
        // Note: Netlify /sites endpoint lists all sites the user has access to.
        // We filter by account locally or use the account-specific endpoint if it exists.
        // The /accounts/{account_id}/sites endpoint is standard.
        sites = await client.get<NetlifySite[]>(`/accounts/${account.slug}/sites`);
    } catch (err) {
      failures.push({
        scope: "sites",
        context: account.name,
        message: err instanceof Error ? err.message : "Failed to list sites",
      });
      continue;
    }

    // 2) List environment variables for the account
    // Netlify (new API) handles env vars at the account level, potentially scoped to sites.
    let envVars: NetlifyEnvVar[] = [];
    try {
      envVars = await client.get<NetlifyEnvVar[]>(`/accounts/${account.slug}/env`);
    } catch (err) {
        failures.push({
            scope: "account-envs",
            context: account.name,
            message: err instanceof Error ? err.message : "Failed to retrieve account environment variables",
        });
    }

    // Map account-level env vars
    for (const ev of envVars) {
        for (const val of ev.values) {
            records.push({
                id: val.id,
                key: ev.key,
                value: val.value,
                providerType: "plain", // Netlify doesn't have "sensitive" mask in API yet
                readableByAttacker: true,
                targets: [val.context],
                projectId: account.slug, // Using account as project for account-level vars
                projectName: account.name,
                teamId: account.id,
                teamName: account.name,
                updatedAt: new Date(ev.updated_at).getTime(),
            });
        }
    }

    // Optional: detect integrations (Netlify has "Build Plugins" and "Integrations")
    // For now, we'll skip deep integration detection unless requested.

    currentAccountIdx++;
  }

  opts.onProgress?.("Done", 100);
  return { records, integrations, failures };
}
