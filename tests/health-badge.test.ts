import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyHealthBadgeArtifact,
  createGrocyHealthBadgeArtifactFromHealth,
  recordGrocyHealthBadgeArtifact,
} from "../src/health-badge.js";
import { GrocyHealthBadgeArtifactSchema } from "../src/schemas.js";

describe("Grocy health badge", () => {
  it("creates a compact failing badge artifact with short failure codes", () => {
    const artifact = createGrocyHealthBadgeArtifactFromHealth({
      generatedAt: "2026-04-21T07:00:00.000Z",
      health: {
        status: {
          toolId: "grocy",
          reachable: false,
          mode: "write_enabled",
          notes: ["Grocy request failed: 503 Service Unavailable for /stock"],
        },
      },
    });

    expect(artifact.badge).toEqual({
      label: "grocy health",
      message: "fail: grocy_unreachable",
      color: "red",
    });
    expect(artifact.summary).toEqual({
      status: "fail",
      failureCodes: ["grocy_unreachable"],
      componentCount: 2,
    });
    expect(artifact.components).toEqual([
      { id: "config", status: "pass", code: undefined },
      { id: "live_api", status: "fail", code: "grocy_unreachable" },
    ]);
    expect(JSON.stringify(artifact)).not.toContain("503 Service Unavailable");
  });

  it("derives a passing badge artifact from diagnostics", () => {
    const artifact = createGrocyHealthBadgeArtifact({
      diagnostics: {
        kind: "grocy_health_diagnostics",
        version: 1,
        generatedAt: "2026-04-21T07:00:00.000Z",
        toolId: "grocy",
        summary: {
          result: "pass",
          failureCount: 0,
          warningCount: 0,
        },
        checks: [
          {
            id: "config",
            status: "pass",
            message: "Local Grocy config is present at config/grocy.local.json.",
          },
          {
            id: "live_api",
            status: "pass",
            message: "Live API read probes completed.",
          },
        ],
        diagnostics: [
          {
            severity: "info",
            code: "grocy_reachable",
            message: "Grocy live adapter completed its read probes.",
            agentAction: "No immediate agent action is required.",
            evidence: [],
          },
        ],
        triage: {
          classification: "healthy",
          severity: "info",
          summary: "Grocy health checks passed, so no immediate operator follow-up is required.",
        },
        nextActions: [],
      },
    });

    expect(artifact.badge).toEqual({
      label: "grocy health",
      message: "pass",
      color: "green",
    });
    expect(artifact.summary.failureCodes).toEqual([]);
  });

  it("writes the badge artifact to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-badge-"));
    const outputPath = recordGrocyHealthBadgeArtifact(
      createGrocyHealthBadgeArtifactFromHealth({
        generatedAt: "2026-04-21T07:00:00.000Z",
        health: {
          status: {
            toolId: "grocy",
            reachable: false,
            mode: "write_enabled",
            notes: ["No Grocy live config found at C:\\workspace\\grocy\\config\\grocy.local.json."],
          },
        },
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-health-badge.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_health_badge",
      summary: { status: "fail", failureCodes: ["config_missing"] },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-health-badge.example.json"), "utf8")) as unknown;

    expect(() => GrocyHealthBadgeArtifactSchema.parse(example)).not.toThrow();
  });
});
