import { classifyVar } from "./classifier.js";
import type {
  RiskItem,
  RiskReport,
  ScanFailure,
  Severity,
  VarRecord,
} from "./types.js";

const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

export function sortRiskItems(items: RiskItem[]): RiskItem[] {
  return [...items].sort((a, b) => {
    const severityDiff = compareSeverity(a.severity, b.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return a.variable.key.localeCompare(b.variable.key);
  });
}

export function buildRiskReport(input: {
  records: VarRecord[];
  integrations: RiskReport["integrations"];
  failures?: ScanFailure[];
  scannedAt?: string;
}): RiskReport {
  const items = sortRiskItems(input.records.map(classifyVar));

  return {
    scannedAt: input.scannedAt ?? new Date().toISOString(),
    isPartial: (input.failures?.length ?? 0) > 0,
    stats: {
      totalProjects: new Set(input.records.map((record) => record.projectId))
        .size,
      totalVars: input.records.length,
      varsReadableByAttacker: input.records.filter(
        (record) => record.readableByAttacker,
      ).length,
      criticalCount: items.filter((item) => item.severity === "critical")
        .length,
      highCount: items.filter((item) => item.severity === "high").length,
      mediumCount: items.filter((item) => item.severity === "medium").length,
    },
    items,
    integrations: input.integrations,
    failures: input.failures ?? [],
  };
}
