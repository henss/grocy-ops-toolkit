import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyDesiredStateManifestLintReport,
  GROCY_DESIRED_STATE_LINT_REPORT_PATH,
  recordGrocyDesiredStateManifestLintReport,
} from "../src/desired-state-lint.js";
import type { GrocyConfigManifest } from "../src/schemas.js";

const repoRoot = process.cwd();
const tsxCommand = process.platform === "win32"
  ? path.join(repoRoot, "node_modules", ".bin", "tsx.cmd")
  : path.join(repoRoot, "node_modules", ".bin", "tsx");
function runCliFrom(cwd: string, args: string[]): ReturnType<typeof spawnSync> {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", tsxCommand, ...args], {
      cwd,
      encoding: "utf8",
    });
  }
  return spawnSync(tsxCommand, args, { cwd, encoding: "utf8" });
}

function createManifest(items: GrocyConfigManifest["items"]): GrocyConfigManifest {
  return {
    kind: "grocy_config_manifest",
    version: 1,
    updatedAt: "2026-04-21T09:00:00.000Z",
    notes: ["Synthetic lint fixture."],
    items,
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeManifestFixture(baseDir: string, items: GrocyConfigManifest["items"]): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "desired-state.json"),
    JSON.stringify(createManifest(items), null, 2),
    "utf8",
  );
}

function runSyntheticDiffPreview(baseDir: string, planPath: string, previewPath: string): ReturnType<typeof spawnSync> {
  return runCliFrom(baseDir, [
    path.join(repoRoot, "src", "cli.ts"),
    "grocy:diff-config",
    "--manifest",
    path.join(repoRoot, "examples", "desired-state.example.json"),
    "--export",
    path.join(repoRoot, "examples", "config-export.example.json"),
    "--output",
    planPath,
    "--preview-output",
    previewPath,
    "--force",
  ]);
}

describe("Desired-state manifest lint", () => {
  it("accepts the public desired-state example", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "examples", "desired-state.example.json"), "utf8"),
    ) as GrocyConfigManifest;

    const report = createGrocyDesiredStateManifestLintReport({
      manifest,
      manifestPath: "examples/desired-state.example.json",
      generatedAt: "2026-04-21T09:05:00.000Z",
    });

    expect(report.summary).toEqual({
      itemCount: 1,
      errorCount: 0,
      warningCount: 0,
      ready: true,
    });
    expect(report.findings).toEqual([]);
  });

  it("rejects duplicate keys, duplicate candidates, and volatile fields", () => {
    const report = createGrocyDesiredStateManifestLintReport({
      manifest: createManifest([
        {
          key: "products.example-coffee",
          entity: "products",
          name: "Example Coffee",
          ownership: "repo_managed",
          fields: { min_stock_amount: 1, last_price: 5.25 },
          aliases: ["Example Alias", "Example Alias"],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-coffee",
          entity: "products",
          name: "Example Alias",
          ownership: "repo_managed",
          fields: {},
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
      ]),
      manifestPath: "config/desired-state.json",
      generatedAt: "2026-04-21T09:10:00.000Z",
    });

    expect(report.summary).toEqual({
      itemCount: 2,
      errorCount: 4,
      warningCount: 0,
      ready: false,
    });
    expect(report.findings.map((finding) => finding.code)).toEqual([
      "duplicate_item_key",
      "duplicate_alias",
      "duplicate_match_candidate",
      "volatile_field_declared",
    ]);
  });

  it("records the lint report on the conventional output path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-manifest-lint-report-"));
    const report = createGrocyDesiredStateManifestLintReport({
      manifest: createManifest([]),
      manifestPath: "config/desired-state.json",
      generatedAt: "2026-04-21T09:15:00.000Z",
    });

    const outputPath = recordGrocyDesiredStateManifestLintReport(report, { baseDir });

    expect(outputPath).toBe(path.join(baseDir, GROCY_DESIRED_STATE_LINT_REPORT_PATH));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_desired_state_manifest_lint_report",
      summary: { ready: true },
    });
  });

  it("fails diff before the live config path when lint errors exist", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-diff-lint-gate-"));
    writeManifestFixture(baseDir, [
      {
        key: "products.example-coffee",
        entity: "products",
        name: "Example Coffee",
        ownership: "repo_managed",
        fields: { last_price: 5.25 },
        aliases: [],
        provenance: { source: "synthetic", notes: [] },
      },
    ]);

    const result = runCliFrom(baseDir, [path.join(repoRoot, "src", "cli.ts"), "grocy:diff-config"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Desired-state manifest lint failed");
    expect(result.stderr).toContain("volatile");
    expect(result.stderr).not.toContain("Grocy live config is missing");
  });

  it("writes a diff preview report alongside the sync plan for synthetic exports", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-diff-preview-"));
    const planPath = path.join("data", "custom-sync-plan.json");
    const previewPath = path.join("data", "custom-diff-preview.json");

    const result = runSyntheticDiffPreview(baseDir, planPath, previewPath);

    expect(result.status).toBe(0);

    const plan = readJson<{ kind: string; summary: { update: number } }>(path.join(baseDir, planPath));
    const preview = readJson<{
      kind: string;
      summary: { update: number; reviewedChangeCount: number };
      items: Array<{ action: string; key: string }>;
    }>(path.join(baseDir, previewPath));

    expect(plan.kind).toBe("grocy_config_sync_plan");
    expect(plan.summary.update).toBe(1);
    expect(preview).toMatchObject({
      kind: "grocy_config_diff_preview_report",
      summary: {
        update: 1,
        reviewedChangeCount: 1,
      },
      items: [{ action: "update", key: "products.example-coffee" }],
    });
  });
});
