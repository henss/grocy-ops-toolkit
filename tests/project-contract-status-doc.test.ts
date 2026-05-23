import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const docsIndexPath = path.join(repoRoot, "docs", "README.md");
const projectContractStatusPath = path.join(repoRoot, "docs", "maintainers", "project-contract-status.md");
const verificationDocPath = path.join(repoRoot, "docs", "agents", "verification.md");

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Project contract status doc", () => {
  it("is linked from the docs index", () => {
    const docsIndex = readText(docsIndexPath);

    expect(docsIndex).toContain("[Project Contract Status](./maintainers/project-contract-status.md)");
  });

  it("explains packet precedence, synthesized-summary fallback, and public scope", () => {
    const doc = readText(projectContractStatusPath);

    expect(doc).toContain("runtime launch packet");
    expect(doc).toContain("project registry, synced tracker cache, or local-probe automation");
    expect(doc).toContain("public-safe source of truth");
    expect(doc).toContain("npm-first commands");
    expect(doc).toContain("no committed package-manager lockfile");
    expect(doc).toContain("support infrastructure");
    expect(doc).toContain("standalone product roadmap");
  });
});

describe("Generated verification doc", () => {
  it("stays aligned to the npm-first verification surface", () => {
    const doc = readText(verificationDocPath);

    expect(doc).toContain("`npm run verify:session`");
    expect(doc).toContain("`npm test`");
    expect(doc).toContain("`npm run build`");
    expect(doc).toContain("`npm run typecheck`");
    expect(doc).not.toContain("`pnpm ");
  });

  it("does not track a package-manager lockfile in git", () => {
    for (const fileName of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]) {
      const result = spawnSync("git", ["ls-files", "--error-unmatch", fileName], {
        cwd: repoRoot,
        encoding: "utf8",
      });

      expect(result.status).not.toBe(0);
    }
  });
});
