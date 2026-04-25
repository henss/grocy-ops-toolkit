import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyEvaluatorStarterPack,
  GROCY_EVALUATOR_STARTER_PACK_PATH,
  recordGrocyEvaluatorStarterPack,
  GrocyEvaluatorStarterPackSchema,
} from "../src/evaluator-starter-pack.js";
import { GROCY_DEMO_ENVIRONMENT_PATH, GROCY_DEMO_SUPPORT_BUNDLE_PATH } from "../src/demo-lab.js";
import { GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH } from "../src/quickstart-proof.js";

const repoExamplesDir = path.resolve("examples");
const cliEntrypoint = path.resolve("src", "cli.ts");
const tsxEntrypoint = path.resolve("node_modules", "tsx", "dist", "cli.mjs");

function setupStarterPackBase(prefix: string): string {
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

describe("Grocy evaluator starter pack", () => {
  it("creates a one-command synthetic evaluator-facing starter pack", async () => {
    const baseDir = setupStarterPackBase("grocy-evaluator-starter-pack-");

    const starterPack = await createGrocyEvaluatorStarterPack(baseDir, {
      generatedAt: "2026-04-25T12:00:00.000Z",
    });
    const outputPath = recordGrocyEvaluatorStarterPack(starterPack, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_EVALUATOR_STARTER_PACK_PATH);
    expect(starterPack.summary).toEqual({
      status: "pass",
      shareability: "ready_to_share",
      artifactCount: 4,
      recommendedReadingCount: 3,
    });
    expect(starterPack.entrypoints.map((entrypoint) => entrypoint.id)).toEqual([
      "starter_pack_receipt",
      "quickstart_proof",
      "review_dashboard",
      "support_bundle",
    ]);

    for (const artifactPath of [
      GROCY_EVALUATOR_STARTER_PACK_PATH,
      GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH,
      GROCY_DEMO_ENVIRONMENT_PATH,
      GROCY_DEMO_SUPPORT_BUNDLE_PATH,
    ]) {
      expect(fs.existsSync(path.join(baseDir, artifactPath))).toBe(true);
    }
  });

  it("runs the evaluator starter pack through the CLI", () => {
    const baseDir = setupStarterPackBase("grocy-evaluator-starter-pack-cli-");

    const stdout = execFileSync(process.execPath, [tsxEntrypoint, cliEntrypoint, "grocy:evaluator:starter-pack"], {
      cwd: baseDir,
      encoding: "utf8",
    });

    const parsedStdout = JSON.parse(stdout) as {
      summary: { status: string; shareability: string };
      entrypoints: Array<{ id: string; path: string }>;
    };

    expect(parsedStdout.summary).toMatchObject({ status: "pass", shareability: "ready_to_share" });
    expect(parsedStdout.entrypoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "starter_pack_receipt", path: "data/grocy-evaluator-starter-pack.json" }),
      expect.objectContaining({ id: "quickstart_proof", path: "data/grocy-quickstart-proof-receipt.json" }),
    ]));
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_EVALUATOR_STARTER_PACK_PATH), "utf8"))).toMatchObject({
      kind: "grocy_evaluator_starter_pack",
      summary: { status: "pass", shareability: "ready_to_share" },
    });
  });

  it("keeps the public example starter-pack schema-valid", () => {
    const example = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-evaluator-starter-pack.example.json"), "utf8"),
    ) as unknown;

    expect(() => GrocyEvaluatorStarterPackSchema.parse(example)).not.toThrow();
  });
});
