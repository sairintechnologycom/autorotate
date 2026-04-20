import { describe, expect, it } from "vitest";
import { classifyVar } from "../src/classifier";
import { buildRiskReport } from "../src/report";
import type { ScanFailure, VarRecord } from "../src/types";

describe("Pattern Matching", () => {
  const mockVar = (
    key: string,
    value: string | null,
    type: VarRecord["providerType"] = "plain",
  ): VarRecord => ({
    id: "1",
    key,
    value,
    providerType: type,
    readableByAttacker: type !== "sensitive",
    targets: ["production"],
    projectId: "p1",
    projectName: "Project 1",
  });

  const secret = (...p: string[]) => p.join("");

  it("detects AWS Access Key ID", () => {
    const v = mockVar("MY_KEY", secret("AKIA", "0".repeat(16)));
    const risk = classifyVar(v);
    expect(risk.severity).toBe("critical");
    expect(risk.matches[0].patternId).toBe("aws-access-key");
    expect(risk.matches[0].excerpt).toBe("AKIA…0000");
  });

  it("detects AWS Secret Key by name", () => {
    const v = mockVar("AWS_SECRET_ACCESS_KEY", "some-random-val");
    const risk = classifyVar(v);
    expect(risk.severity).toBe("critical");
    expect(risk.matches[0].patternId).toBe("aws-secret-by-name");
  });

  it("detects GitHub PAT", () => {
    const v = mockVar("GH_TOKEN", secret("ghp_", "0".repeat(36)));
    const risk = classifyVar(v);
    expect(risk.severity).toBe("critical");
    expect(risk.matches[0].patternId).toBe("gh-pat-classic");
  });

  it("detects Stripe live key", () => {
    const v = mockVar("STRIPE_KEY", secret("sk", "_", "live", "_", "0".repeat(24)));
    const risk = classifyVar(v);
    expect(risk.severity).toBe("critical");
    expect(risk.matches[0].patternId).toBe("stripe-live-secret");
  });

  it("detects Stripe test key with medium severity", () => {
    const v = mockVar("STRIPE_KEY", secret("sk", "_", "test", "_", "0".repeat(24)));
    const risk = classifyVar(v);
    expect(risk.severity).toBe("medium");
    expect(risk.matches[0].patternId).toBe("stripe-test-secret");
  });

  it("masks sensitive values correctly", () => {
    const v = mockVar(
      "OPENAI_KEY",
      secret("sk", "-", "proj", "-", "0".repeat(24))
    );
    const risk = classifyVar(v);
    expect(risk.matches[0].excerpt).toBe("sk-p…0000");
  });

  it("marks unclassified exposed vars as low severity", () => {
    const v = mockVar("PORT", "3000");
    const risk = classifyVar(v);
    expect(risk.severity).toBe("low");
    expect(risk.matches[0].patternId).toBe("unclassified-exposed");
  });

  it("ignores sensitive-type variables", () => {
    const v = mockVar("SECRET", null, "sensitive");
    const risk = classifyVar(v);
    expect(risk.severity).toBe("info");
    expect(risk.matches).toHaveLength(0);
  });

  it("marks the report as partial when scan failures exist", () => {
    const failures: ScanFailure[] = [
      {
        scope: "project-envs",
        context: "Personal Account / app",
        message: "Rate limited",
      },
    ];
    const report = buildRiskReport({
      records: [mockVar("AWS_SECRET_ACCESS_KEY", "some-random-val")],
      integrations: { github: false, linear: false, other: [] },
      failures,
      scannedAt: "2026-04-20T00:00:00.000Z",
    });

    expect(report.isPartial).toBe(true);
    expect(report.failures).toEqual(failures);
    expect(report.items[0].severity).toBe("critical");
  });
});
