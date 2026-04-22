import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const walkthroughPath = path.join(repoRoot, "docs", "fixture-only-restore-drill-walkthrough.md");

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Fixture-only restore drill walkthrough", () => {
  it("documents a machine-checkable validation command for the generated report", () => {
    const walkthrough = readText(walkthroughPath);

    expect(fs.existsSync(walkthroughPath)).toBe(true);
    expect(walkthrough).toContain("## Validate The Artifact");
    expect(walkthrough).toContain("node --input-type=module -e");
    expect(walkthrough).toContain("data/fixture-only-restore-drill-report.json");
    expect(walkthrough).toContain("Restore drill checkpoints validated.");
    expect(walkthrough).toContain("report.scope !== 'synthetic_fixture_only'");
    expect(walkthrough).toContain("report.summary?.wouldOverwrite !== 0");
    expect(walkthrough).toContain("checkpoint.status === 'pass'");
    expect(walkthrough).toContain("report.artifacts?.manifestPath === 'data/grocy-backup-manifest.json'");
    expect(walkthrough).toContain("report.checkpoints?.[2]?.artifactPath === 'restore/fixture-only-restore-drill'");
    expect(walkthrough).toContain("snapshot_created");
    expect(walkthrough).toContain("restore_plan_ready");
    expect(walkthrough).toContain("restore_verification_succeeded");
  });
});
