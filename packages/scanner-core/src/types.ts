import type { RunbookEntry } from './runbook.js';

export interface VarRecord {
  id: string;
  key: string;
  value: string | null;              // null if provider returned it as sensitive/unreadable
  providerType: string;              // for Vercel: 'plain'|'encrypted'|'sensitive'|'system'|'secret'
  readableByAttacker: boolean;       // true if type !== 'sensitive'
  targets: string[];                 // ['production','preview',...]
  projectId: string;
  projectName: string;
  teamId?: string;
  teamName?: string;
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
  runbook?: RunbookEntry;
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
