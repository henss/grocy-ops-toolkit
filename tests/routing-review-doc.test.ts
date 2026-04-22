import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
};

const repoRoot = process.cwd();
const readmePath = path.join(repoRoot, "README.md");
const routingReviewPath = path.join(repoRoot, "docs", "recovery-confidence-routing-review.md");
const packageJsonPath = path.join(repoRoot, "package.json");

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function parsePackageJson(): PackageJson {
  return JSON.parse(readText(packageJsonPath)) as PackageJson;
}

describe("Recovery confidence routing review doc", () => {
  it("is linked from the public README surface", () => {
    const readme = readText(readmePath);

    expect(readme).toContain("[Recovery Confidence Routing Review](docs/recovery-confidence-routing-review.md)");
  });

  it("routes readers through real public commands and existing docs", () => {
    const routingReview = readText(routingReviewPath);
    const packageJson = parsePackageJson();
    const scripts = packageJson.scripts ?? {};

    expect(fs.existsSync(routingReviewPath)).toBe(true);
    expect(routingReview).toContain("## Route 1: Config Diff And Apply Dry Run");
    expect(routingReview).toContain("## Route 2: Mock Smoke");
    expect(routingReview).toContain("## Route 3: Backup Snapshot, Integrity Receipt, Restore Plan, And Restore Verification");
    expect(routingReview).toContain("npm run grocy:review:dashboard");
    expect(routingReview).toContain("The dashboard is the aggregation surface.");
    expect(routingReview).toContain("[Fixture-Only Restore Drill Walkthrough](fixture-only-restore-drill-walkthrough.md)");
    expect(routingReview).toContain(
      "[Synthetic Backup Passphrase Rotation Rehearsal](synthetic-backup-passphrase-rotation-rehearsal.md)",
    );

    for (const scriptName of [
      "grocy:desired-state:lint",
      "grocy:diff-config",
      "grocy:apply-config",
      "grocy:smoke:mock",
      "grocy:backup:snapshot",
      "grocy:backup:receipt",
      "grocy:backup:restore-plan",
      "grocy:backup:verify",
      "grocy:backup:receipt:verify",
      "grocy:review:dashboard",
    ]) {
      expect(routingReview).toContain(`npm run ${scriptName}`);
      expect(scripts[scriptName]).toBeTruthy();
    }

    for (const artifactPath of [
      "data/review-desired-state-lint.json",
      "data/review-config-sync-plan.json",
      "data/review-apply-dry-run.json",
      "data/review-mock-smoke.json",
      "data/review-mock-smoke-receipt.json",
      "data/review-backup-restore-plan.json",
      "data/review-dashboard.md",
    ]) {
      expect(routingReview).toContain(artifactPath);
    }

    expect(routingReview).toContain("grocy_backup_integrity_receipt");
    expect(routingReview).toContain("grocy_backup_integrity_receipt_verification");
  });
});
