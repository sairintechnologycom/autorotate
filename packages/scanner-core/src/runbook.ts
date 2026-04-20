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
