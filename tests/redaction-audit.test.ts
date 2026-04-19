import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditGrocyPublicArtifacts,
  recordGrocyPublicArtifactRedactionAudit,
} from "../src/redaction-audit.js";

function writeFile(baseDir: string, filePath: string, value: string): void {
  const absolutePath = path.join(baseDir, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value, "utf8");
}

describe("Grocy public artifact redaction audit", () => {
  it("passes synthetic public artifacts and writes the conventional report", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-redaction-audit-pass-"));
    writeFile(
      baseDir,
      path.join("examples", "public-report.example.json"),
      `${JSON.stringify({
        kind: "example_public_report",
        sourceUrl: "https://grocy.example.com",
        apiKey: "replace-with-api-key",
        artifactPath: "data/grocy-health-diagnostics.json",
      }, null, 2)}\n`,
    );

    const audit = auditGrocyPublicArtifacts({
      baseDir,
      generatedAt: "2026-04-19T11:00:00.000Z",
    });
    const outputPath = recordGrocyPublicArtifactRedactionAudit(audit, { baseDir });

    expect(audit.summary).toEqual({ result: "pass", scannedFileCount: 1, findingCount: 0 });
    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-public-artifact-redaction-audit.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_public_artifact_redaction_audit",
      summary: { result: "pass" },
    });
  });

  it("reports private-shaped artifact content without echoing sensitive snippets", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-redaction-audit-fail-"));
    writeFile(
      baseDir,
      path.join("data", "generated-report.json"),
      [
        "{",
        '  "sourcePath": "D:\\\\workspace\\\\private\\\\grocy.sqlite",',
        '  "baseUrl": "https://grocy.private.invalid/api",',
        '  "apiKey": "super-secret-live-key",',
        '  "notes": ["Stefan household workflow"]',
        "}",
      ].join("\n"),
    );

    const audit = auditGrocyPublicArtifacts({
      baseDir,
      paths: ["data"],
      generatedAt: "2026-04-19T11:00:00.000Z",
    });
    const serializedAudit = JSON.stringify(audit);

    expect(audit.summary.result).toBe("fail");
    expect(audit.findings.map((finding) => finding.code)).toEqual([
      "absolute_local_path",
      "private_url",
      "credential_value",
      "private_boundary_term",
    ]);
    expect(serializedAudit).toContain("data/generated-report.json");
    expect(serializedAudit).not.toContain("private\\\\grocy.sqlite");
    expect(serializedAudit).not.toContain("grocy.private.invalid");
    expect(serializedAudit).not.toContain("super-secret-live-key");
    expect(serializedAudit).not.toContain("Stefan household workflow");
  });

  it("ignores paths outside the repository boundary", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-redaction-audit-boundary-"));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-redaction-audit-outside-"));
    writeFile(outsideDir, "private.json", '{"apiKey":"super-secret-live-key"}\n');

    const audit = auditGrocyPublicArtifacts({
      baseDir,
      paths: [outsideDir],
      generatedAt: "2026-04-19T11:00:00.000Z",
    });

    expect(audit.summary).toEqual({ result: "pass", scannedFileCount: 0, findingCount: 0 });
  });
});
