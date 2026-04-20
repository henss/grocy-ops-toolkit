import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGrocySupportBundle, recordGrocySupportBundle } from "../src/support-bundle.js";

function writeJson(baseDir: string, filePath: string, value: unknown): void {
  const absolutePath = path.join(baseDir, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("Grocy support bundle", () => {
  it("creates an offline sanitized support manifest from generated artifacts", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-support-bundle-"));
    writeJson(baseDir, path.join("data", "grocy-health-diagnostics.json"), {
      kind: "grocy_health_diagnostics",
      version: 1,
      generatedAt: "2026-04-20T10:00:00.000Z",
      summary: { result: "pass", failureCount: 0, warningCount: 0 },
    });
    writeJson(baseDir, path.join("data", "grocy-mock-smoke-report.json"), {
      kind: "grocy_mock_smoke_report",
      version: 1,
      generatedAt: "2026-04-20T10:01:00.000Z",
      summary: { result: "pass", checkCount: 4, failureCount: 0 },
    });

    const bundle = createGrocySupportBundle({
      baseDir,
      generatedAt: "2026-04-20T10:02:00.000Z",
    });
    const outputPath = recordGrocySupportBundle(bundle, { baseDir });

    expect(bundle.summary).toEqual({
      readiness: "ready_to_share",
      artifactCount: 2,
      redactionFindingCount: 0,
    });
    expect(bundle.artifacts.map((artifact) => artifact.path)).toEqual([
      "data/grocy-health-diagnostics.json",
      "data/grocy-mock-smoke-report.json",
    ]);
    expect(bundle.artifacts[0]).toMatchObject({
      type: "json",
      kind: "grocy_health_diagnostics",
      summary: { result: "pass", failureCount: 0, warningCount: 0 },
    });
    expect(bundle.omitted).toContain("Raw Grocy record payloads.");
    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-support-bundle.json"));
  });

  it("redacts sensitive-shaped summary strings and reports audit findings without snippets", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-support-bundle-redaction-"));
    writeJson(baseDir, path.join("data", "generated-report.json"), {
      kind: "synthetic_report",
      version: 1,
      generatedAt: "2026-04-20T10:00:00.000Z",
      summary: {
        result: "fail",
        sourcePath: "C:\\synthetic\\grocy.sqlite",
        baseUrl: "https://demo.invalid/api",
      },
      apiKey: "actual-token-value",
    });

    const bundle = createGrocySupportBundle({
      baseDir,
      artifactPaths: [path.join("data", "generated-report.json")],
      generatedAt: "2026-04-20T10:02:00.000Z",
    });
    const serializedBundle = JSON.stringify(bundle);

    expect(bundle.summary.readiness).toBe("needs_redaction_review");
    expect(bundle.redactionAudit.findingCodes).toEqual(["absolute_local_path", "credential_value", "private_url"]);
    expect(bundle.artifacts[0].summary).toEqual({
      result: "fail",
      sourcePath: "<redacted-summary-value>",
      baseUrl: "<redacted-summary-value>",
    });
    expect(serializedBundle).not.toContain("actual-token-value");
    expect(serializedBundle).not.toContain("demo.invalid");
    expect(serializedBundle).not.toContain("synthetic\\grocy.sqlite");
  });

  it("rejects artifact paths outside the repository boundary", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-support-bundle-boundary-"));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-support-bundle-outside-"));
    writeJson(outsideDir, "report.json", { kind: "outside_report", summary: { result: "pass" } });

    expect(() => createGrocySupportBundle({
      baseDir,
      artifactPaths: [path.join(outsideDir, "report.json")],
    })).toThrow("must stay inside the repository");
  });

  it("writes the support bundle through the CLI", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-support-bundle-cli-"));
    writeJson(baseDir, path.join("data", "grocy-mock-smoke-report.json"), {
      kind: "grocy_mock_smoke_report",
      version: 1,
      generatedAt: "2026-04-20T10:01:00.000Z",
      summary: { result: "pass", checkCount: 4, failureCount: 0 },
    });

    const result = spawnSync(
      process.execPath,
      [
        path.resolve("node_modules", "tsx", "dist", "cli.mjs"),
        path.resolve("src", "cli.ts"),
        "grocy:support:bundle",
        "--output",
        path.join("data", "support.json"),
      ],
      { cwd: baseDir, encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      summary: { readiness: "ready_to_share", artifactCount: 1 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "support.json"), "utf8"))).toMatchObject({
      kind: "grocy_support_bundle",
      summary: { readiness: "ready_to_share" },
    });
  });
});
