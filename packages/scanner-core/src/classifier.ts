import { PATTERNS } from "./patterns.js";
import { RUNBOOK } from "./runbook.js";
import type { PatternMatch, RiskItem, Severity, VarRecord } from "./types.js";

const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

function mask(value: string): string {
  if (value.length <= 10) return "…";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function classifyVar(v: VarRecord): RiskItem {
  if (!v.readableByAttacker) {
    return {
      variable: v,
      matches: [],
      severity: "info",
      rationale: "Marked sensitive — encrypted at rest, not exposed.",
    };
  }

  const matches: PatternMatch[] = [];

  for (const p of PATTERNS) {
    let matched: "value" | "key" | null = null;
    let excerpt = "";

    try {
      if (p.valueRegex && v.value) {
        const m = v.value.match(p.valueRegex);
        if (m) {
          matched = "value";
          excerpt = mask(m[0]);
        }
      }
      if (!matched && p.keyRegex && p.keyRegex.test(v.key)) {
        matched = "key";
        excerpt = v.key;
      }
    } catch (e) {
      // Silently catch regex errors on malformed values
    }

    if (matched) {
      matches.push({
        patternId: p.id,
        patternName: p.name,
        severity: p.severity,
        provider: p.provider,
        matchedOn: matched,
        excerpt,
        runbookId: p.runbookId,
      });
    }
  }

  if (matches.length === 0 && v.readableByAttacker) {
    matches.push({
      patternId: "unclassified-exposed",
      patternName: "Unclassified env var (readable by attacker)",
      severity: "low",
      provider: "Unknown",
      matchedOn: "key",
      excerpt: v.key,
      runbookId: "generic-unknown",
    });
  }

  const severity = matches.length
    ? matches
        .map((m) => m.severity)
        .sort(
          (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
        )[0]
    : "info";

  const runbook =
    matches.length > 0 ? RUNBOOK[matches[0].runbookId] : undefined;

  return {
    variable: v,
    matches,
    severity,
    rationale: buildRationale(v, matches),
    runbook,
  };
}

function buildRationale(v: VarRecord, matches: PatternMatch[]): string {
  if (!v.readableByAttacker)
    return "Marked sensitive — encrypted at rest, not exposed.";
  if (matches.length === 0)
    return "Non-sensitive env var. No known secret pattern matched, but the value was readable.";
  const top = matches[0];
  return `Non-sensitive env var matched pattern: ${top.patternName}. Rotate at ${top.provider}.`;
}
