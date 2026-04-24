import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyReadmeQuickstartProofReceipt,
  GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH,
  GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH,
  GROCY_README_QUICKSTART_DRIFT_TREND_PATH,
  GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH,
  GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH,
  GROCY_README_QUICKSTART_LINT_PATH,
  GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH,
  GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH,
  GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH,
  GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
  recordGrocyReadmeQuickstartProofReceipt,
} from "../src/quickstart-proof.js";
import { GrocyReadmeQuickstartProofReceiptSchema } from "../src/quickstart-proof-schema.js";

const repoExamplesDir = path.resolve("examples");
const cliEntrypoint = path.resolve("src", "cli.ts");
const tsxEntrypoint = path.resolve("node_modules", "tsx", "dist", "cli.mjs");

function setupQuickstartProofBase(prefix: string): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(baseDir, "examples"), { recursive: true });
  for (const fileName of [
    "desired-state.example.json",
    "config-export.example.json",
    "config-export.previous.example.json",
  ]) {
    fs.copyFileSync(path.join(repoExamplesDir, fileName), path.join(baseDir, "examples", fileName));
  }
  fs.cpSync(
    path.join(repoExamplesDir, "synthetic-grocy-backup-source"),
    path.join(baseDir, "examples", "synthetic-grocy-backup-source"),
    { recursive: true },
  );
  return baseDir;
}

describe("README quickstart proof receipt", () => {
  it("proves the synthetic README recipes and stages the public-safe artifacts", async () => {
    const baseDir = setupQuickstartProofBase("grocy-quickstart-proof-");

    const receipt = await createGrocyReadmeQuickstartProofReceipt(baseDir, {
      generatedAt: "2026-04-25T09:00:00.000Z",
    });
    const outputPath = recordGrocyReadmeQuickstartProofReceipt(receipt, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH);
    expect(receipt.summary).toEqual({
      status: "pass",
      recipeCount: 3,
      artifactCount: 13,
    });
    expect(receipt.recipes.map((recipe) => recipe.id)).toEqual([
      "quick_start_preflight",
      "fresh_agent_cold_start_loop",
      "demo_lab_one_command",
    ]);

    for (const artifactPath of [
      GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH,
      GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH,
      GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH,
      GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH,
      GROCY_README_QUICKSTART_LINT_PATH,
      GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
      GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH,
      GROCY_README_QUICKSTART_DRIFT_TREND_PATH,
      GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH,
      path.join("data", "grocy-demo-environment.json"),
      path.join("data", "demo-public-artifact-redaction-audit.json"),
      path.join("data", "demo-review-dashboard.md"),
      path.join("data", "demo-support-bundle.json"),
      path.join("config", "grocy-demo-backup.local.json"),
      path.join("backups", "demo", "grocy-backup-manifest.json"),
      GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH,
    ]) {
      expect(fs.existsSync(path.join(baseDir, artifactPath))).toBe(true);
    }

    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH), "utf8"))).toMatchObject({
      kind: "grocy_health_diagnostics",
      summary: { result: "fail" },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH), "utf8"))).toMatchObject({
      kind: "grocy_toolkit_run_receipt",
      result: { status: "pass" },
    });
  });

  it("runs the proof receipt through the CLI", () => {
    const baseDir = setupQuickstartProofBase("grocy-quickstart-proof-cli-");

    const stdout = execFileSync(process.execPath, [tsxEntrypoint, cliEntrypoint, "grocy:quickstart:proof"], {
      cwd: baseDir,
      encoding: "utf8",
    });

    expect(JSON.parse(stdout)).toMatchObject({
      summary: { status: "pass", recipeCount: 3, artifactCount: 13 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH), "utf8"))).toMatchObject({
      kind: "grocy_readme_quickstart_proof_receipt",
      summary: { status: "pass" },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-quickstart-proof-receipt.example.json"), "utf8")) as unknown;

    expect(() => GrocyReadmeQuickstartProofReceiptSchema.parse(example)).not.toThrow();
  });
});
