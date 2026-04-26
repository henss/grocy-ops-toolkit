import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyMultiInstanceNamespacePrototype,
  recordGrocyMultiInstanceNamespacePrototype,
} from "../src/multi-instance-namespace-prototype.js";
import { GrocyMultiInstanceNamespacePrototypeSchema } from "../src/schemas.js";

describe("Grocy multi-instance namespace prototype", () => {
  it("creates a public-safe synthetic namespace layout proof", () => {
    const artifact = createGrocyMultiInstanceNamespacePrototype({
      generatedAt: "2026-04-25T14:00:00.000Z",
    });

    expect(artifact.scope).toBe("synthetic_namespace_example");
    expect(artifact.summary).toEqual({
      namespaceCount: 2,
      validationStatus: "pass",
      validationCount: 4,
      passCount: 4,
      failCount: 0,
      overlappingPathCount: 0,
    });
    expect(artifact.namespaces).toEqual([
      expect.objectContaining({
        namespaceId: "demo-alpha",
        rootDir: "instances/demo-alpha",
        configDir: "instances/demo-alpha/config",
        dataDir: "instances/demo-alpha/data",
        backupsDir: "instances/demo-alpha/backups",
        restoreDir: "instances/demo-alpha/restore",
      }),
      expect.objectContaining({
        namespaceId: "demo-beta",
        rootDir: "instances/demo-beta",
        configDir: "instances/demo-beta/config",
        dataDir: "instances/demo-beta/data",
        backupsDir: "instances/demo-beta/backups",
        restoreDir: "instances/demo-beta/restore",
      }),
    ]);
    expect(artifact.validations).toContainEqual(
      expect.objectContaining({
        id: "namespace_ids_safe_for_paths",
        status: "pass",
      }),
    );
    expect(artifact.validations).toContainEqual(
      expect.objectContaining({
        id: "namespace_paths_non_overlapping",
        status: "pass",
      }),
    );
  });

  it("writes the generated namespace proof to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-multi-instance-namespace-"));
    const artifact = createGrocyMultiInstanceNamespacePrototype({
      generatedAt: "2026-04-25T14:00:00.000Z",
    });

    const outputPath = recordGrocyMultiInstanceNamespacePrototype(artifact, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-multi-instance-namespace-prototype.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_multi_instance_namespace_prototype",
      scope: "synthetic_namespace_example",
      summary: { namespaceCount: 2, validationStatus: "pass" },
    });
  });

  it("fails validation when a namespace id would create nested or non-portable paths", () => {
    const artifact = createGrocyMultiInstanceNamespacePrototype({
      generatedAt: "2026-04-25T14:00:00.000Z",
      namespaceIds: ["demo-alpha", "demo-alpha/config"],
    });

    expect(artifact.summary.validationStatus).toBe("fail");
    expect(artifact.summary.failCount).toBe(2);
    expect(artifact.validations).toContainEqual(
      expect.objectContaining({
        id: "namespace_ids_safe_for_paths",
        status: "fail",
        evidence: [
          "demo-alpha/config must use lowercase letters, numbers, and hyphens only so generated paths stay portable and cannot nest.",
        ],
      }),
    );
    expect(artifact.validations).toContainEqual(
      expect.objectContaining({
        id: "namespace_paths_non_overlapping",
        status: "fail",
      }),
    );
  });

  it("keeps the public example fixture schema-valid", () => {
    const examplePath = path.resolve("examples", "grocy-multi-instance-namespace-prototype.example.json");
    const parsed = JSON.parse(fs.readFileSync(examplePath, "utf8"));

    expect(GrocyMultiInstanceNamespacePrototypeSchema.parse(parsed)).toMatchObject({
      kind: "grocy_multi_instance_namespace_prototype",
      scope: "synthetic_namespace_example",
      summary: { namespaceCount: 2, validationStatus: "pass", validationCount: 4 },
    });
  });

  it("does not serialize live credentials, URLs, private paths, or private workflow language", () => {
    const artifact = createGrocyMultiInstanceNamespacePrototype({
      generatedAt: "2026-04-25T14:00:00.000Z",
    });
    const serialized = JSON.stringify(artifact);

    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("D:\\");
    expect(serialized).not.toContain("household");
    expect(serialized).not.toContain("Stefan");
    expect(serialized).not.toContain("shopping intent");
  });
});
