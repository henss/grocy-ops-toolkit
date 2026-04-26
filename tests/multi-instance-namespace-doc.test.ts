import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
};

const repoRoot = process.cwd();

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function parsePackageJson(): PackageJson {
  return JSON.parse(readText(path.join(repoRoot, "package.json"))) as PackageJson;
}

describe("Multi-instance namespace prototype doc", () => {
  it("is linked from the public README and examples index", () => {
    const readme = readText(path.join(repoRoot, "README.md"));
    const examplesReadme = readText(path.join(repoRoot, "examples", "README.md"));

    expect(readme).toContain("[Multi-Instance Namespace Prototype](docs/multi-instance-namespace-prototype.md)");
    expect(examplesReadme).toContain("[Multi-Instance Namespace Prototype](../docs/multi-instance-namespace-prototype.md)");
  });

  it("documents a real script, output artifact, and synthetic boundary", () => {
    const doc = readText(path.join(repoRoot, "docs", "multi-instance-namespace-prototype.md"));
    const packageJson = parsePackageJson();

    expect(doc).toContain("npm run grocy:namespace:prototype");
    expect(doc).toContain("data/grocy-multi-instance-namespace-prototype.json");
    expect(doc).toContain("instances/demo-alpha");
    expect(doc).toContain("instances/demo-beta");
    expect(doc).toContain("lowercase letters, numbers, and hyphens");
    expect(doc).toContain("public-safe");
    expect(doc).toContain("multi-tenant product commitment");
    expect(packageJson.scripts?.["grocy:namespace:prototype"]).toBeTruthy();
  });
});
