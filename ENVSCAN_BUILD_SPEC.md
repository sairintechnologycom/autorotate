# EnvScan — Vercel Breach Rotation Utility

**Project codename:** `envscan` (working title — see §2.3)
**Timeline target:** v0.1 in a single focused session, ~6–10 hours
**Owner:** Bhushan
**Audience:** Claude Code (autonomous build) + human reviewer

---

## 0. How to use this document

Read top-to-bottom before coding. Each sprint (§9) is self-contained. Don't skip scanner-core — everything depends on it.

Before UI work, Claude Code should load the `frontend-design` skill if available in its environment and apply its tokens. When this spec and the official Vercel REST API docs disagree, **the Vercel docs win**. Canonical references:

- Env var list: `vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name`
- Env var single decrypt: `vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id`
- Projects list: `vercel.com/docs/rest-api/reference/endpoints/projects`

---

## 1. Context — why this exists

On 19 April 2026 Vercel disclosed a security incident. Attack chain:

1. `Context.ai` was breached in March 2026.
2. A Vercel employee had signed up for Context.ai using their Vercel-enterprise Google Workspace account with "Allow All" OAuth scopes.
3. Attacker used the compromised OAuth token to take over that Google Workspace account.
4. Escalated into Vercel internal environments.
5. Enumerated customer env vars **not** marked `sensitive`. (Sensitive vars are encrypted at rest and remained unreadable.)
6. Claimed exfiltration includes npm tokens, GitHub tokens, internal DB, source code fragments — for sale on BreachForums at $2M.

**Blast radius per Vercel customer:** every env var across every project where `type !== 'sensitive'`, plus Vercel↔GitHub and Vercel↔Linear integration tokens.

EnvScan's job — in under 5 minutes, answer three questions:

1. **"Am I exposed?"** — Which env vars were readable by the attacker?
2. **"What do I rotate first?"** — Classify by secret type and blast radius.
3. **"How do I rotate each one?"** — Per-secret-type runbook with provider links.

Non-goals for v0.1: automated rotation, audit-log fetching (checklist only), multi-provider support (architected for it, not shipped).

---

## 2. Strategic framing

### 2.1 Positioning
Neutral utility by an independent developer. Not branded as BurnCap in v0.1. Footer credit line is fine.

### 2.2 Trust is the product
This tool asks for a Vercel access token 48h after Vercel got breached. Every decision bends toward user confidence that the tool isn't a second compromise:

- **100% client-side.** No backend. Vercel API called directly from the browser. Token never crosses our infrastructure.
- **Open source from day one.** MIT, public repo, CI on every push.
- **Zero telemetry on the scan flow.** Plausible (cookieless) or none, landing page only.
- **Readable code.** No minified bundles without source maps.
- **CSP locked down.** Only `connect-src` allowed is `api.vercel.com`. Documented in README, visible in DevTools.

### 2.3 Naming
Pick before merge. Preference order: **`envscan`** (domain `envscan.dev`, provider-agnostic, extends to Netlify/Render later) → `rotatekit` → `vercel-rotate` (narrow, SEO-strong for this cycle only).

### 2.4 Extension path
Scanner-core and runbook are provider-agnostic. Only the adapter changes. Vercel first; Netlify adapter should be a ~200-line PR.

---

## 3. Architecture

### 3.1 Repo layout (pnpm workspaces monorepo)

```
envscan/
├── README.md                       # public-facing, trust statement included
├── LICENSE                         # MIT
├── SECURITY.md                     # token handling, issue reporting
├── CLAUDE.md                       # agent operating instructions (§8)
├── package.json
├── pnpm-workspace.yaml
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── packages/
│   ├── scanner-core/               # provider-agnostic engine
│   │   ├── src/{patterns,classifier,runbook,types,index}.ts
│   │   └── test/patterns.test.ts
│   ├── adapter-vercel/             # Vercel API client + mapping
│   │   └── src/{client,enumerate,integrations,types,index}.ts
│   ├── web/                        # Vite + React + Tailwind, static export
│   │   ├── src/{components,pages,lib,App.tsx,main.tsx}
│   │   └── public/_headers
│   └── cli/                        # npx runner
│       ├── src/index.ts
│       └── bin/envscan.js
└── docs/
    ├── rotation-runbook.md
    └── vercel-breach-timeline.md
```

### 3.2 Data flow

```
[ user pastes Vercel token in browser ]
      │
      ▼
[ web UI ] ──► [ adapter-vercel ] ──► api.vercel.com
                    │
                    ▼
           [ normalised VarRecord[] ]
                    │
                    ▼
             [ scanner-core ]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
[ classifier → RiskReport ] [ runbook → Steps[] ]
        │                       │
        └───────────┬───────────┘
                    ▼
            [ web UI renders ]
                    │
                    ▼
     [ export: markdown / JSON / Linear ticket ]
```

CLI uses the same two packages, prints terminal report instead of rendering UI.

### 3.3 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Shared types across packages |
| Pkg manager | pnpm | Workspace-native |
| Frontend | Vite + React 18 | Simple static output. Deliberately not Next.js — not deploying on Vercel for optics |
| Styling | Tailwind | Fast iteration |
| Icons | lucide-react | Clean, MIT |
| Hosting | **Cloudflare Pages** | Not Vercel (optics). Free global edge. |
| CLI runtime | Node 20+ | Native fetch, no deps |
| Testing | Vitest | Cross-package, fast |
| Linting | Biome | One tool, faster |

No analytics. No auth. No database. No server.

---

## 4. Scanner Core (`packages/scanner-core`)

### 4.1 Types (`src/types.ts`)

```ts
export interface VarRecord {
  id: string;
  key: string;
  value: string | null;              // null if provider returned it as sensitive/unreadable
  providerType: string;              // for Vercel: 'plain'|'encrypted'|'sensitive'|'system'|'secret'
  readableByAttacker: boolean;       // true if type !== 'sensitive'
  targets: string[];                 // ['production','preview',...]
  projectId: string;
  projectName: string;
  createdAt?: number;
  updatedAt?: number;
  comment?: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PatternMatch {
  patternId: string;
  patternName: string;
  severity: Severity;
  provider: string;
  matchedOn: 'value' | 'key';
  excerpt: string;                   // masked, e.g. "sk_live_…7Kp2"
  runbookId: string;
}

export interface RiskItem {
  variable: VarRecord;
  matches: PatternMatch[];
  severity: Severity;
  rationale: string;
}

export interface RiskReport {
  scannedAt: string;                 // ISO
  stats: {
    totalProjects: number;
    totalVars: number;
    varsReadableByAttacker: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
  };
  items: RiskItem[];                 // sorted by severity desc, then name
  integrations: {
    github: boolean;
    linear: boolean;
    other: string[];
  };
}
```

### 4.2 Pattern library (`src/patterns.ts`)

Each pattern has id, name, regex(es), severity, provider, runbook id. Checked against env var **name** (e.g. `STRIPE_SECRET_KEY`) and **value** when present. Value match beats key match. Precision > recall for v0.1.

```ts
export interface Pattern {
  id: string;
  name: string;
  provider: string;
  severity: Severity;
  runbookId: string;
  valueRegex?: RegExp;
  keyRegex?: RegExp;
}

export const PATTERNS: Pattern[] = [
  // Cloud providers
  { id: 'aws-access-key', name: 'AWS Access Key ID', provider: 'AWS', severity: 'critical', runbookId: 'aws',
    valueRegex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'aws-temp-key', name: 'AWS Temporary Access Key', provider: 'AWS', severity: 'high', runbookId: 'aws',
    valueRegex: /\bASIA[0-9A-Z]{16}\b/ },
  { id: 'aws-secret-by-name', name: 'Likely AWS Secret Access Key (by name)', provider: 'AWS', severity: 'critical', runbookId: 'aws',
    keyRegex: /AWS_?SECRET_?ACCESS_?KEY/i },
  { id: 'gcp-service-account', name: 'GCP Service Account Key (JSON)', provider: 'GCP', severity: 'critical', runbookId: 'gcp',
    valueRegex: /"type"\s*:\s*"service_account"/ },
  { id: 'gcp-api-key', name: 'Google API Key', provider: 'GCP', severity: 'high', runbookId: 'gcp',
    valueRegex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'azure-conn-string', name: 'Azure Storage Connection String', provider: 'Azure', severity: 'critical', runbookId: 'azure',
    valueRegex: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=/i },

  // Source control
  { id: 'gh-pat-classic', name: 'GitHub Personal Access Token (classic)', provider: 'GitHub', severity: 'critical', runbookId: 'github',
    valueRegex: /\bghp_[0-9A-Za-z]{36}\b/ },
  { id: 'gh-pat-fine', name: 'GitHub Fine-grained PAT', provider: 'GitHub', severity: 'critical', runbookId: 'github',
    valueRegex: /\bgithub_pat_[0-9A-Za-z_]{82}\b/ },
  { id: 'gh-oauth', name: 'GitHub OAuth Token', provider: 'GitHub', severity: 'critical', runbookId: 'github',
    valueRegex: /\bgho_[0-9A-Za-z]{36}\b/ },
  { id: 'gh-app-token', name: 'GitHub App/Server Token', provider: 'GitHub', severity: 'critical', runbookId: 'github',
    valueRegex: /\bghs_[0-9A-Za-z]{36}\b/ },
  { id: 'gh-user-to-server', name: 'GitHub User-to-Server Token', provider: 'GitHub', severity: 'critical', runbookId: 'github',
    valueRegex: /\bghu_[0-9A-Za-z]{36}\b/ },
  { id: 'gitlab-pat', name: 'GitLab Personal Access Token', provider: 'GitLab', severity: 'high', runbookId: 'gitlab',
    valueRegex: /\bglpat-[0-9A-Za-z_-]{20}\b/ },

  // Package registries
  { id: 'npm-token', name: 'npm Access Token', provider: 'npm', severity: 'critical', runbookId: 'npm',
    valueRegex: /\bnpm_[0-9A-Za-z]{36}\b/ },

  // Payments
  { id: 'stripe-live-secret', name: 'Stripe Live Secret Key', provider: 'Stripe', severity: 'critical', runbookId: 'stripe',
    valueRegex: /\bsk_live_[0-9A-Za-z]{20,}\b/ },
  { id: 'stripe-test-secret', name: 'Stripe Test Secret Key', provider: 'Stripe', severity: 'medium', runbookId: 'stripe',
    valueRegex: /\bsk_test_[0-9A-Za-z]{20,}\b/ },
  { id: 'stripe-restricted-live', name: 'Stripe Restricted Live Key', provider: 'Stripe', severity: 'high', runbookId: 'stripe',
    valueRegex: /\brk_live_[0-9A-Za-z]{20,}\b/ },

  // AI providers
  { id: 'openai-key', name: 'OpenAI API Key', provider: 'OpenAI', severity: 'high', runbookId: 'openai',
    valueRegex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { id: 'anthropic-key', name: 'Anthropic API Key', provider: 'Anthropic', severity: 'high', runbookId: 'anthropic',
    valueRegex: /\bsk-ant-(?:api\d{2}|admin\d{2})-[A-Za-z0-9_-]{80,}\b/ },
  { id: 'google-genai-key', name: 'Google Generative AI Key', provider: 'Google AI', severity: 'high', runbookId: 'gcp',
    keyRegex: /(GEMINI|GOOGLE_GENERATIVE|GOOGLE_AI)_?API_?KEY/i },

  // Databases
  { id: 'postgres-url', name: 'Postgres Connection URL', provider: 'Database', severity: 'critical', runbookId: 'database',
    valueRegex: /\bpostgres(?:ql)?:\/\/[^\s]+/ },
  { id: 'mysql-url', name: 'MySQL Connection URL', provider: 'Database', severity: 'critical', runbookId: 'database',
    valueRegex: /\bmysql:\/\/[^\s]+/ },
  { id: 'mongo-url', name: 'MongoDB Connection URL', provider: 'Database', severity: 'critical', runbookId: 'database',
    valueRegex: /\bmongodb(?:\+srv)?:\/\/[^\s]+/ },
  { id: 'redis-url', name: 'Redis Connection URL', provider: 'Database', severity: 'high', runbookId: 'database',
    valueRegex: /\brediss?:\/\/[^\s]+/ },

  // Auth / identity
  { id: 'supabase-service', name: 'Supabase Service Role Key (by name)', provider: 'Supabase', severity: 'critical', runbookId: 'supabase',
    keyRegex: /SUPABASE.*SERVICE.*(ROLE|KEY)/i },
  { id: 'clerk-secret', name: 'Clerk Secret Key', provider: 'Clerk', severity: 'critical', runbookId: 'clerk',
    keyRegex: /CLERK.*SECRET/i },
  { id: 'nextauth-secret', name: 'NextAuth / Auth.js Secret', provider: 'NextAuth', severity: 'high', runbookId: 'nextauth',
    keyRegex: /(NEXTAUTH_SECRET|AUTH_SECRET)/ },
  { id: 'jwt-secret-name', name: 'JWT Signing Secret (by name)', provider: 'Generic', severity: 'high', runbookId: 'jwt',
    keyRegex: /JWT_?SECRET/i },

  // Messaging & email
  { id: 'slack-token', name: 'Slack Token', provider: 'Slack', severity: 'high', runbookId: 'slack',
    valueRegex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'twilio-sid', name: 'Twilio Account SID', provider: 'Twilio', severity: 'high', runbookId: 'twilio',
    valueRegex: /\bAC[0-9a-f]{32}\b/ },
  { id: 'twilio-auth', name: 'Twilio Auth Token (by name)', provider: 'Twilio', severity: 'high', runbookId: 'twilio',
    keyRegex: /TWILIO.*(AUTH|TOKEN)/i },
  { id: 'sendgrid-key', name: 'SendGrid API Key', provider: 'SendGrid', severity: 'high', runbookId: 'sendgrid',
    valueRegex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  { id: 'mailgun-key', name: 'Mailgun API Key', provider: 'Mailgun', severity: 'high', runbookId: 'mailgun',
    valueRegex: /\bkey-[0-9a-f]{32}\b/ },
  { id: 'resend-key', name: 'Resend API Key', provider: 'Resend', severity: 'high', runbookId: 'resend',
    valueRegex: /\bre_[A-Za-z0-9_]{16,}\b/ },

  // Generic fallbacks
  { id: 'private-key-pem', name: 'PEM Private Key', provider: 'Generic', severity: 'critical', runbookId: 'generic-key',
    valueRegex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY-----/ },
  { id: 'jwt-value', name: 'JWT Token (value)', provider: 'Generic', severity: 'medium', runbookId: 'jwt',
    valueRegex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
  { id: 'generic-secret-name', name: 'Variable named like a secret', provider: 'Generic', severity: 'medium', runbookId: 'generic-unknown',
    keyRegex: /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY)$/i },
];
```

Notes:
- Wrap every regex match in try/catch — one malformed value shouldn't crash the scan.
- Generic-by-name fires only when nothing stronger matched.
- Never log or store raw matched values. Mask to first-4 + `…` + last-4.

### 4.3 Classifier (`src/classifier.ts`)

```ts
import { PATTERNS } from './patterns';
import type { VarRecord, RiskItem, PatternMatch, Severity } from './types';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function mask(value: string): string {
  if (value.length <= 10) return '…';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function classifyVar(v: VarRecord): RiskItem {
  const matches: PatternMatch[] = [];

  for (const p of PATTERNS) {
    let matched: 'value' | 'key' | null = null;
    let excerpt = '';

    if (p.valueRegex && v.value) {
      const m = v.value.match(p.valueRegex);
      if (m) { matched = 'value'; excerpt = mask(m[0]); }
    }
    if (!matched && p.keyRegex && p.keyRegex.test(v.key)) {
      matched = 'key'; excerpt = v.key;
    }
    if (matched) {
      matches.push({
        patternId: p.id, patternName: p.name, severity: p.severity,
        provider: p.provider, matchedOn: matched, excerpt, runbookId: p.runbookId,
      });
    }
  }

  if (matches.length === 0 && v.readableByAttacker) {
    matches.push({
      patternId: 'unclassified-exposed',
      patternName: 'Unclassified env var (readable by attacker)',
      severity: 'low', provider: 'Unknown', matchedOn: 'key',
      excerpt: v.key, runbookId: 'generic-unknown',
    });
  }

  const severity = matches.length
    ? matches.map(m => m.severity).sort(
        (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
      )[0]
    : 'info';

  return { variable: v, matches, severity, rationale: buildRationale(v, matches) };
}

function buildRationale(v: VarRecord, matches: PatternMatch[]): string {
  if (!v.readableByAttacker) return 'Marked sensitive — encrypted at rest, not exposed.';
  if (matches.length === 0) return 'Non-sensitive env var. No known secret pattern matched, but the value was readable.';
  const top = matches[0];
  return `Non-sensitive env var matched pattern: ${top.patternName}. Rotate at ${top.provider}.`;
}
```

### 4.4 Runbook (`src/runbook.ts`)

Short, concrete, clickable. Keys: `aws`, `github`, `npm`, `stripe`, `openai`, `anthropic`, `gcp`, `azure`, `database`, `supabase`, `clerk`, `nextauth`, `jwt`, `slack`, `twilio`, `sendgrid`, `mailgun`, `resend`, `gitlab`, `generic-key`, `generic-unknown`.

```ts
export interface RunbookEntry {
  id: string;
  title: string;
  steps: string[];              // each ≤140 chars
  consoleUrl: string;
  postRotationNote: string;
}

export const RUNBOOK: Record<string, RunbookEntry> = {
  aws: {
    id: 'aws',
    title: 'Rotate AWS IAM access keys',
    steps: [
      'Open IAM → Users → [affected user] → Security credentials.',
      'Create a new access key pair. Save the new pair to your password manager.',
      'Update Vercel env vars AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY with the new pair.',
      'Redeploy every Vercel project that uses these keys.',
      'After 15–30 min of stable traffic, deactivate the old key.',
      'After 24h of no failures, delete the old key.',
    ],
    consoleUrl: 'https://console.aws.amazon.com/iam/home#/users',
    postRotationNote: 'Redeploy every project after updating the env vars.',
  },
  github: {
    id: 'github',
    title: 'Rotate GitHub tokens',
    steps: [
      'Open GitHub → Settings → Developer settings → Personal access tokens.',
      'Revoke every token in the exposed list.',
      'Generate replacements with minimum scopes required.',
      'Update Vercel env vars and any GitHub Action secrets.',
      'If using a GitHub App, rotate the private key in Settings → Developer settings → GitHub Apps.',
      'Review GitHub audit log (Settings → Security log) for 1 Apr 2026 → now.',
    ],
    consoleUrl: 'https://github.com/settings/tokens',
    postRotationNote: 'Redeploy Vercel projects; re-run CI workflows using these tokens.',
  },
  npm: {
    id: 'npm',
    title: 'Rotate npm access tokens',
    steps: [
      'Open npmjs.com → Avatar → Access Tokens.',
      'Revoke every token in the exposed list.',
      'Generate replacement with minimum type (read-only if possible).',
      'Update Vercel env vars and CI secrets.',
      'Audit recent publishes — verify no unexpected package versions during the window.',
    ],
    consoleUrl: 'https://www.npmjs.com/settings/~/tokens',
    postRotationNote: 'If you publish packages, verify no unexpected versions were published.',
  },
  stripe: {
    id: 'stripe',
    title: 'Roll Stripe secret keys',
    steps: [
      'Open Stripe Dashboard → Developers → API keys.',
      'Click "Roll key" on exposed secret key(s).',
      'Set grace-period expiry, then update Vercel env vars.',
      'Redeploy every project. Verify webhooks still fire.',
      'After confirming the new key in production, let the old key expire.',
      'Revoke and regenerate any restricted keys.',
    ],
    consoleUrl: 'https://dashboard.stripe.com/apikeys',
    postRotationNote: 'Use Stripe\'s built-in grace period — don\'t hard-cut.',
  },
  openai: {
    id: 'openai',
    title: 'Rotate OpenAI API keys',
    steps: [
      'Open platform.openai.com → API keys.',
      'Delete exposed keys.',
      'Create replacements, scoped per-project where possible.',
      'Update Vercel env vars and redeploy.',
      'Review Usage dashboard for anomalous spend during the window.',
    ],
    consoleUrl: 'https://platform.openai.com/api-keys',
    postRotationNote: 'Check Usage dashboard for unexpected spikes.',
  },
  anthropic: {
    id: 'anthropic',
    title: 'Rotate Anthropic API keys',
    steps: [
      'Open console.anthropic.com → Settings → API Keys.',
      'Delete exposed keys.',
      'Create replacements, scoped per workspace.',
      'Update Vercel env vars, redeploy.',
      'Review usage logs for anomalous activity during the window.',
    ],
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    postRotationNote: 'Check usage logs for unexpected activity.',
  },
  gcp: {
    id: 'gcp',
    title: 'Rotate GCP credentials',
    steps: [
      'API keys: console.cloud.google.com → APIs & Services → Credentials → delete and recreate.',
      'Service accounts: IAM → Service accounts → Keys → delete exposed key, create new.',
      'Update Vercel env vars with new JSON or API key.',
      'Redeploy. Verify background jobs still work.',
      'Audit Cloud Logging for unexpected API calls during the window.',
    ],
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    postRotationNote: 'Check Cloud Logging for unexpected usage.',
  },
  azure: {
    id: 'azure',
    title: 'Rotate Azure credentials',
    steps: [
      'Storage: Portal → Storage account → Access keys → Rotate key.',
      'Service principals: Entra ID → App registrations → [app] → Certificates & secrets.',
      'Update Vercel env vars, redeploy.',
      'Review activity logs for unexpected access.',
    ],
    consoleUrl: 'https://portal.azure.com',
    postRotationNote: 'Storage key rotation is instant; service principal secrets support overlap.',
  },
  database: {
    id: 'database',
    title: 'Rotate database credentials',
    steps: [
      'Connect as a privileged user.',
      'Rotate the user\'s password (Postgres: ALTER USER app_user WITH PASSWORD \'<new>\';).',
      'Update Vercel env vars with the new connection URL.',
      'Redeploy. Verify pooler (PgBouncer/Neon/Supabase Pooler) still works.',
      'Review query logs for unexpected activity during the window.',
      'Tighten IP allowlists if applicable.',
    ],
    consoleUrl: '',
    postRotationNote: 'Consider mTLS or IAM-based auth over long-lived passwords.',
  },
  supabase: {
    id: 'supabase',
    title: 'Rotate Supabase keys',
    steps: [
      'Open Supabase Dashboard → Project → Settings → API.',
      'Click "Generate new JWT secret" — rotates service_role + anon keys.',
      'Update Vercel env vars (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      'Redeploy. Cached client tokens will need to re-auth.',
      'Audit Dashboard → Logs → API logs for the window.',
    ],
    consoleUrl: 'https://app.supabase.com',
    postRotationNote: 'Active sessions are logged out when the JWT secret rotates.',
  },
  clerk: {
    id: 'clerk',
    title: 'Rotate Clerk keys',
    steps: [
      'Open dashboard.clerk.com → [app] → API Keys.',
      'Rotate secret keys (Clerk supports overlap periods).',
      'Update Vercel env vars, redeploy.',
    ],
    consoleUrl: 'https://dashboard.clerk.com',
    postRotationNote: 'Clerk supports grace-period rotation.',
  },
  nextauth: {
    id: 'nextauth',
    title: 'Rotate NextAuth / Auth.js secret',
    steps: [
      'Generate new secret: openssl rand -base64 32.',
      'Update AUTH_SECRET / NEXTAUTH_SECRET in Vercel.',
      'Redeploy. All user sessions invalidated — everyone must log in again.',
    ],
    consoleUrl: '',
    postRotationNote: 'Time this for off-peak — everyone is logged out.',
  },
  jwt: {
    id: 'jwt',
    title: 'Rotate JWT signing secret',
    steps: [
      'Generate new secret: openssl rand -base64 64.',
      'Deploy with dual-verify (accept old + new signatures for the migration window).',
      'After longest expected token TTL elapses, remove the old secret.',
    ],
    consoleUrl: '',
    postRotationNote: 'Dual-verify avoids a mass logout.',
  },
  slack: {
    id: 'slack',
    title: 'Rotate Slack tokens',
    steps: [
      'Open api.slack.com/apps → [your app] → OAuth & Permissions.',
      'Revoke exposed token. Reinstall the app to generate a new one.',
      'Update Vercel env vars, redeploy.',
    ],
    consoleUrl: 'https://api.slack.com/apps',
    postRotationNote: 'Workspace admin may need to re-authorise.',
  },
  twilio: {
    id: 'twilio',
    title: 'Rotate Twilio auth token',
    steps: [
      'Console → Account → API keys & tokens.',
      'Rotate Auth Token (primary → secondary swap for zero-downtime).',
      'Update Vercel env vars with the new token.',
      'Redeploy. Verify SMS/voice webhooks.',
    ],
    consoleUrl: 'https://console.twilio.com',
    postRotationNote: 'Primary/secondary flow enables no-downtime rotation.',
  },
  sendgrid: {
    id: 'sendgrid',
    title: 'Rotate SendGrid API key',
    steps: [
      'app.sendgrid.com → Settings → API Keys.',
      'Delete exposed key. Create replacement with minimum permissions.',
      'Update Vercel env vars, redeploy. Send a test email.',
    ],
    consoleUrl: 'https://app.sendgrid.com/settings/api_keys',
    postRotationNote: 'Verify email delivery didn\'t break.',
  },
  mailgun: {
    id: 'mailgun', title: 'Rotate Mailgun API key',
    steps: ['app.mailgun.com → API keys.', 'Rotate the affected key.', 'Update Vercel env vars, redeploy.'],
    consoleUrl: 'https://app.mailgun.com/app/account/security/api_keys', postRotationNote: '',
  },
  resend: {
    id: 'resend', title: 'Rotate Resend API key',
    steps: ['resend.com/api-keys.', 'Revoke exposed key; create replacement.', 'Update Vercel env vars, redeploy.'],
    consoleUrl: 'https://resend.com/api-keys', postRotationNote: '',
  },
  gitlab: {
    id: 'gitlab', title: 'Rotate GitLab PAT',
    steps: ['gitlab.com → Avatar → Preferences → Access Tokens.', 'Revoke exposed token; create replacement.', 'Update Vercel and CI vars.'],
    consoleUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens', postRotationNote: '',
  },
  'generic-key': {
    id: 'generic-key', title: 'Rotate private key',
    steps: ['Generate new key pair.', 'Update the service that trusts this key (upload new public key / swap cert).', 'Update Vercel env var.', 'Redeploy.'],
    consoleUrl: '', postRotationNote: 'Depends on the service — follow its key rotation docs.',
  },
  'generic-unknown': {
    id: 'generic-unknown', title: 'Review and rotate',
    steps: ['Identify which system this secret belongs to (the env var name is a hint).', 'Follow that system\'s rotation docs.', 'Update Vercel env var; redeploy.'],
    consoleUrl: '', postRotationNote: 'If you can\'t identify it, remove the var and see what breaks in preview.',
  },
};
```

### 4.5 Tests

At minimum `packages/scanner-core/test/patterns.test.ts`:
- Each pattern matches a known positive and does NOT match a known negative.
- `classifyVar` gives `critical` for an `AKIA…` value.
- `classifyVar` returns `info` for a sensitive-type var with no match.
- Mask correctly masks a 40-char value to 4+…+4.

Target >95% coverage on scanner-core.

---

## 5. Vercel Adapter (`packages/adapter-vercel`)

### 5.1 Client (`src/client.ts`)

Tiny fetch wrapper — bearer auth, `teamId` injection, 429 retries with `Retry-After`, typed errors:

```ts
const BASE = 'https://api.vercel.com';

export class VercelApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export class VercelClient {
  constructor(private token: string, private teamId?: string) {}

  async get<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
    const qs = new URLSearchParams();
    if (this.teamId) qs.set('teamId', this.teamId);
    for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
    const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
      if (res.status === 429) {
        const retry = Number(res.headers.get('retry-after') ?? 1);
        await new Promise(r => setTimeout(r, retry * 1000));
        continue;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new VercelApiError(res.status, body?.error?.code ?? 'unknown',
          body?.error?.message ?? res.statusText);
      }
      return res.json() as Promise<T>;
    }
    throw new VercelApiError(429, 'rate_limited', 'Too many requests');
  }
}
```

### 5.2 Enumerate (`src/enumerate.ts`)

Core adapter function — token in, `VarRecord[]` out:

```ts
import type { VarRecord } from '@envscan/scanner-core';
import { VercelClient } from './client';

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
```

**Caveats for the implementer:**
- Pagination shape of `/v9/projects` may differ in live API. Verify on a test token before shipping.
- Integrations endpoint path has historically changed. Scan degrades gracefully if detection fails.
- Team-scoped tokens may require `teamId` on every call. If scan returns zero projects, prompt user for their team ID from the Vercel dashboard URL.

---

## 6. CLI (`packages/cli`)

Usable as `npx @envscan/cli scan --token $VERCEL_TOKEN [--team $TEAM_ID] [--json] [--out report.md]`. Minimal, no deps beyond scanner-core + adapter.

### 6.1 Behaviour
1. Missing `--token` → read `VERCEL_TOKEN` env → else prompt via readline.
2. Progress bar via `process.stderr.write`.
3. After scan: print stats header, top 10 findings by severity, path to written markdown.
4. `--json` → full `RiskReport` to stdout, no human summary.

### 6.2 Markdown report layout

```
# EnvScan Report — 2026-04-20

**Vercel breach rotation checklist** generated by EnvScan.

## Summary
- Projects scanned: 12
- Environment variables: 147
- Readable by attacker (non-sensitive): 89
- Critical findings: 3
- High findings: 11
- Medium findings: 6

## Critical — rotate now

### [project-a] STRIPE_SECRET_KEY — Stripe Live Secret Key
- **Excerpt:** sk_live_…7Kp2
- **Why:** Non-sensitive env var matched Stripe live-key pattern.
- **Rotate at:** https://dashboard.stripe.com/apikeys
- **Steps:**
  1. Open Stripe Dashboard → Developers → API keys.
  2. Click "Roll key" on the exposed secret key(s).
  …

## Integrations detected
- GitHub ✅ — review audit log for 1 Apr → now.
- Linear ✅ — review workspace audit log for 1 Apr → now.

## Google Workspace — check OAuth apps
Revoke if present — malicious OAuth client ID:
`110671459871-30f1spbu0hptbs60cb4vsmv79i7bbvqj.apps.googleusercontent.com`
Path: admin.google.com → Security → API Controls → App access control
```

---

## 7. Web App (`packages/web`)

### 7.1 Pages
1. `/` — landing + scan form.
2. `/scan` — in-progress/results (can be same-page state).
3. `/how-it-works` — trust page.
4. `/vercel-breach-rotation-guide` — long-form SEO page. **This catches the search traffic — do not skip.**

### 7.2 Design direction

Load the `frontend-design` skill first. Fallbacks:

- **Palette:** zinc/slate background, **amber-500** accent (caution without alert fatigue). Severity colours only inside the results table.
- **Typography:** Inter/system sans for UI, JetBrains Mono for keys/excerpts.
- **Density:** generous whitespace on landing, compact on results. Linear/Raycast feel, not marketing splashy.
- **Dark mode only.** Developer audience, incident-response context. No toggle.
- **No hero illustration.** A cartoon mascot on a security tool signals toy.
- **Severity colours:** critical=rose-500, high=orange-500, medium=amber-500, low=zinc-400, info=zinc-500.

### 7.3 Landing (above the fold)

```
┌────────────────────────────────────────────────────────────┐
│  envscan                                   [ GitHub ] [?]  │
│                                                            │
│  Check your Vercel env vars for the April 2026 breach.     │
│  Paste a read-only token. We scan in your browser.         │
│  Nothing leaves your device. Source on GitHub.             │
│                                                            │
│  ┌──────────────────────────────────────────────┐          │
│  │  Vercel access token (read-only)             │          │
│  │  vxx_••••••••••••••••••••••••••••••••        │          │
│  └──────────────────────────────────────────────┘          │
│  ┌──────────────────────────────────────────────┐          │
│  │  Team ID (optional)                          │          │
│  └──────────────────────────────────────────────┘          │
│                                                            │
│  [ Scan now ]                                              │
│                                                            │
│  → No backend. No storage. No telemetry. [verify]          │
└────────────────────────────────────────────────────────────┘
```

Below the fold: "How it works" (3 cards), "What it checks" (pattern categories), FAQ, GitHub footer.

### 7.4 Results view

- **Stats row** — 6 big numbers: projects, vars, readable, critical, high, medium.
- **Integrations row** — chips: "GitHub integration detected" / "Linear integration detected", each → modal with audit-log checklist.
- **Findings list** — grouped by severity, collapsed by default under critical. Each row: project · var key (mono) · pattern name · masked excerpt · "View runbook →" expands inline steps.
- **Export bar** (sticky bottom): `[Copy as markdown]` `[Download JSON]` `[Copy as Linear issue]`.

### 7.5 State

`useReducer` in `App.tsx`, states: `idle | scanning | done | error`. Progress via `onProgress` callback. **Memory only — no localStorage.** Never persist tokens.

### 7.6 Build & deploy

- `pnpm --filter @envscan/web build` → `packages/web/dist/`.
- Cloudflare Pages points at this dir.
- `public/_headers`:
  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://api.vercel.com; img-src 'self' data:;
    Referrer-Policy: no-referrer
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
  ```

---

## 8. `CLAUDE.md` — operating instructions for Claude Code

Drop this at the repo root:

```markdown
# CLAUDE.md

You are working on EnvScan — a browser-based scanner for Vercel env vars, shipped in response to the 19 April 2026 Vercel breach. Read ENVSCAN_BUILD_SPEC.md before every session.

## Non-negotiables

1. Never add a backend. Browser-only. No API routes, no proxy. Re-read §2.2 if tempted.
2. Never persist tokens. Not localStorage, sessionStorage, IndexedDB, cookies. React state only, dies on refresh.
3. Never log env var values or excerpts to the console. Masked excerpts only.
4. No telemetry on the scan flow. Landing-page analytics only, and only if VITE_PLAUSIBLE_DOMAIN is set at build time.
5. Tests must pass before every commit. `pnpm test` and `pnpm lint` green.
6. Conventional Commits.
7. No `.env` files committed. No real tokens in tests — use obviously fake values like `ghp_XXX…XXX`.

## Build discipline

- `pnpm install` at repo root before working in a package.
- When editing scanner-core, run `pnpm --filter @envscan/scanner-core test` after every change.
- When editing adapter-vercel, check types against live API docs — do not invent field names.
- TypeScript strict. No `any` except at parsing boundaries, and even then prefer `unknown` + narrowing.

## What to ship first

Follow sprint order in §9. No web UI before scanner-core tests are green. No deploy before SECURITY.md and the CSP _headers file are in place.

## When stuck

If the Vercel API behaviour contradicts the spec, believe the API, not the spec. Update the spec in the same PR.
```

---

## 9. Sprint breakdown

Four self-contained PRs. ~6–10 hours total for a focused operator.

### Sprint 1 — Scanner core (2h)
Deliverable: `packages/scanner-core` green tests, importable.
1. Init monorepo (pnpm workspaces, TS project refs, Biome).
2. Write `types.ts`, `patterns.ts`, `classifier.ts`, `runbook.ts`.
3. Pattern tests (one positive + one negative per pattern).
4. Classifier tests (severity escalation, mask function, info-level for sensitive).
5. `.github/workflows/ci.yml` — lint + test + build on every PR.

Done when: `pnpm test` green, coverage >95% on scanner-core.

### Sprint 2 — Vercel adapter + CLI (2h)
Deliverable: `npx @envscan/cli scan --token <t>` produces a real markdown report against a real Vercel account.
1. `packages/adapter-vercel`. Test against a throwaway Vercel account with dummy env vars using obvious fake patterns like `STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX`.
2. `packages/cli` — readline prompts, no deps beyond scanner-core + adapter.
3. CLI E2E: mock the adapter, run CLI, assert the report markdown matches a snapshot.

Done when: CLI against test account produces correct severity classifications and a clean markdown file.

### Sprint 3 — Web app (3h)
Deliverable: deployed static site on Cloudflare Pages, end-to-end browser scan works.
1. Scaffold Vite + React + Tailwind.
2. Landing page (§7.3).
3. Scan form + progress display (§7.5).
4. Results view (§7.4).
5. Export functions (markdown, JSON, Linear).
6. `/how-it-works` + SECURITY.md link.
7. CSP `_headers` (§7.6).
8. Cloudflare Pages deploy via `.github/workflows/deploy.yml`.

Done when: deployed site successfully scans a live Vercel account and DevTools → Network shows zero requests to anywhere except `api.vercel.com`.

### Sprint 4 — Launch prep (1h)
Deliverable: shipped on HN.
1. `README.md` with trust statement, screenshot, CLI one-liner.
2. `SECURITY.md`: scope, out-of-scope (no backend), how to report issues.
3. `docs/vercel-breach-rotation-guide.md` — 1500-word SEO article for the `/vercel-breach-rotation-guide` route. Target: "vercel breach rotate keys".
4. Screenshot the results view with dummy data.
5. HN draft: title "Show HN: EnvScan – browser-only scanner for Vercel env vars after the April 2026 breach", body ≤120 words, lead with trust model.
6. Tweet thread: 4 tweets (what happened, what the tool does, why client-side, link).

**Launch sequence (execute in order, spread over ~1 hour):**
1. Push `main` → verify production deploy.
2. Post to HN (07:00–08:00 PT weekday ideal, else immediately).
3. Vercel Community forum (Help category), Next.js Discord `#general`, `r/nextjs`, `r/webdev`.
4. Reply to Theo's and Guillermo Rauch's breach posts with the tool — only if genuinely relevant to the thread.

---

## 10. Decisions you need to make before merge

1. **Name** — `envscan` / `rotatekit` / `vercel-rotate`. Default: `envscan`. Domain needs buying.
2. **BurnCap CTA** — subtle footer link or nothing? Default: subtle footer link, no in-product CTA.
3. **Email capture** on results page for "notify me when Netlify support ships"? Default: **yes, one optional field**. Formspree-style zero-backend. Not a launch blocker.
4. **Post-launch deep-dive article** — "what we learned scanning N Vercel accounts" at day 10–14 if usage warrants? Default: yes.
5. **GitHub org** — personal or spouse-owned? Default: spouse-owned, consistent with portfolio practice.

---

## 11. Explicitly out of scope for v0.1

Documented as "future work" in README — do not build:

- Automated rotation.
- GitHub audit log fetching (we provide the filter strings, user runs them).
- Multi-provider support (Netlify/Render/Railway/Fly.io).
- Continuous monitoring / scheduled scans.
- Team collaboration.
- Browser extension.
- `envscan-action` for GitHub Actions.

Each is a natural v0.2+ feature. Shipping v0.1 cleanly earns the right.

---

## 12. Success metrics — 48h window

- ≥ 3,000 unique landing visits.
- ≥ 500 scans completed (inferable from CDN request volume to `api.vercel.com`).
- ≥ 1 mention from a Vercel employee, Theo, or a well-known Next.js voice.
- ≥ 200 GitHub stars.
- ≥ 150 "notify me" opt-ins if email capture is enabled.

Below these: the tool is useful but the window closed before launch. Extract the scanner engine into a durable v0.2 anyway.
Above these: BurnCap has a meaningful referral source, and you have authority in "AI-era secret hygiene". Double down.

---

**End of spec.**
