import type { Severity } from './types';

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
