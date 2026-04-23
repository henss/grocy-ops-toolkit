import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
};

const repoRoot = process.cwd();
const readmePath = path.join(repoRoot, "README.md");
const routingReviewPath = path.join(repoRoot, "docs", "recovery-confidence-routing-review.md");
const quickstartFixtureGalleryPath = path.join(repoRoot, "docs", "quickstart-fixture-gallery.md");
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

describe("Quickstart fixture gallery doc", () => {
  it("is linked from the public README and examples index", () => {
    const readme = readText(readmePath);
    const examplesReadme = readText(path.join(repoRoot, "examples", "README.md"));

    expect(readme).toContain("[Quickstart Fixture Gallery](docs/quickstart-fixture-gallery.md)");
    expect(examplesReadme).toContain("[Quickstart Fixture Gallery](../docs/quickstart-fixture-gallery.md)");
  });

  it("maps existing fixture families to real commands, docs, and example artifacts", () => {
    const gallery = readText(quickstartFixtureGalleryPath);
    const packageJson = parsePackageJson();
    const scripts = packageJson.scripts ?? {};

    expect(fs.existsSync(quickstartFixtureGalleryPath)).toBe(true);
    expect(gallery).toContain("## Quick Verification Loop");
    expect(gallery).toContain("### 1. Health Failure Fixtures");
    expect(gallery).toContain("### 2. Config Review Fixtures");
    expect(gallery).toContain("### 3. Fixture API Shapes");
    expect(gallery).toContain("### 4. Backup And Recovery Fixtures");
    expect(gallery).toContain("### 5. Review And Boundary Fixtures");
    expect(gallery).toContain("[Synthetic Grocy Demo Lab](synthetic-demo-lab.md)");
    expect(gallery).toContain("[Synthetic Examples For grocy-ops-toolkit](../examples/README.md)");
    expect(gallery).toContain("[Synthetic Grocy Fixture Server](synthetic-fixture-server.md)");
    expect(gallery).toContain("[Fixture-Only Restore Drill Walkthrough](fixture-only-restore-drill-walkthrough.md)");

    for (const scriptName of [
      "grocy:health:badge",
      "grocy:health:diagnostics",
      "grocy:desired-state:lint",
      "grocy:diff-config",
      "grocy:config:drift-trend",
      "grocy:apply-config",
      "grocy:fixtures:serve",
      "grocy:compatibility:matrix",
      "grocy:compatibility:deprecation-canary",
      "grocy:coverage:playground",
      "grocy:backup:snapshot",
      "grocy:backup:restore-plan",
      "grocy:backup:verify",
      "grocy:backup:restore-drill",
      "grocy:backup:receipt",
      "grocy:backup:receipt:verify",
      "grocy:smoke:mock",
      "grocy:review:dashboard",
      "grocy:artifacts:audit-redaction",
      "grocy:support:bundle",
    ]) {
      expect(gallery).toContain(`npm run ${scriptName}`);
      expect(scripts[scriptName]).toBeTruthy();
    }

    for (const examplePath of [
      "examples/grocy-health-badge.example.json",
      "examples/grocy-health-diagnostics.example.json",
      "examples/grocy-desired-state-manifest-lint-report.example.json",
      "examples/config-sync-plan.example.json",
      "examples/grocy-config-drift-trend-report.example.json",
      "examples/config-apply-dry-run-report.example.json",
      "examples/grocy-api-compatibility-matrix.example.json",
      "examples/grocy-api-deprecation-canary-report.example.json",
      "examples/grocy-object-coverage-playground.example.json",
      "examples/grocy-backup-restore-plan-dry-run-report.example.json",
      "examples/grocy-backup-restore-drill-report.example.json",
      "examples/grocy-backup-integrity-receipt.example.json",
      "examples/grocy-backup-integrity-receipt-verification.example.json",
      "examples/grocy-mock-smoke-report.example.json",
      "examples/grocy-review-dashboard.example.md",
      "examples/grocy-public-artifact-redaction-audit.example.json",
      "examples/grocy-support-bundle.example.json",
    ]) {
      expect(gallery).toContain(examplePath);
    }
  });
});
