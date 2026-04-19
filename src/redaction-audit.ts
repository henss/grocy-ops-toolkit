import fs from "node:fs";
import path from "node:path";

export const GROCY_PUBLIC_ARTIFACT_REDACTION_AUDIT_PATH = path.join("data", "grocy-public-artifact-redaction-audit.json");

export type GrocyPublicArtifactRedactionFindingCode =
  | "absolute_local_path"
  | "private_url"
  | "credential_value"
  | "private_boundary_term";

export interface GrocyPublicArtifactRedactionFinding {
  filePath: string;
  line: number;
  code: GrocyPublicArtifactRedactionFindingCode;
  message: string;
}

export interface GrocyPublicArtifactRedactionAudit {
  kind: "grocy_public_artifact_redaction_audit";
  version: 1;
  generatedAt: string;
  scannedPaths: string[];
  summary: {
    result: "pass" | "fail";
    scannedFileCount: number;
    findingCount: number;
  };
  findings: GrocyPublicArtifactRedactionFinding[];
}

export interface GrocyPublicArtifactRedactionAuditOptions {
  baseDir?: string;
  paths?: string[];
  generatedAt?: string;
}

const AUDITABLE_EXTENSIONS = new Set([".json", ".md", ".txt"]);
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist"]);
const DEFAULT_AUDIT_PATHS = ["data", "examples"];
const SAFE_HOSTS = new Set(["example.com", "example.org", "example.net", "localhost", "127.0.0.1", "::1"]);
const PLACEHOLDER_VALUE_PATTERN = /^(?:(?:your|test|example|synthetic|placeholder|redacted|change-me|changeme|replace-with|demo|local)(?:[-_\w. ]*)?)$/i;

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function displayPath(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}

function collectAuditableFiles(baseDir: string, inputPaths: string[]): string[] {
  const files = new Set<string>();
  for (const inputPath of inputPaths) {
    const absolutePath = path.resolve(baseDir, inputPath);
    if (!isPathInside(baseDir, absolutePath) || !fs.existsSync(absolutePath)) {
      continue;
    }
    const stat = fs.statSync(absolutePath);
    if (stat.isFile() && AUDITABLE_EXTENSIONS.has(path.extname(absolutePath))) {
      files.add(absolutePath);
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    const pending = [absolutePath];
    while (pending.length > 0) {
      const directory = pending.pop()!;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) {
            pending.push(path.join(directory, entry.name));
          }
          continue;
        }
        const entryPath = path.join(directory, entry.name);
        if (entry.isFile() && AUDITABLE_EXTENSIONS.has(path.extname(entryPath))) {
          files.add(entryPath);
        }
      }
    }
  }
  return [...files].sort((left, right) => displayPath(baseDir, left).localeCompare(displayPath(baseDir, right)));
}

function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return SAFE_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.hostname.toLowerCase().endsWith(".example.com");
  } catch {
    return false;
  }
}

function isPlaceholderCredential(value: string): boolean {
  return PLACEHOLDER_VALUE_PATTERN.test(value) || value.includes("<") || value.includes("***");
}

function addFinding(
  findings: GrocyPublicArtifactRedactionFinding[],
  filePath: string,
  line: number,
  code: GrocyPublicArtifactRedactionFindingCode,
  message: string,
): void {
  findings.push({ filePath, line, code, message });
}

function auditLine(filePath: string, line: string, lineNumber: number, findings: GrocyPublicArtifactRedactionFinding[]): void {
  if (/(?:^|[\s"'(])[A-Za-z]:[\\/][^\s"')]+/.test(line) || /\/(?:Users|home|workspace|mnt|var\/www|etc)\/[^\s"')]+/.test(line)) {
    addFinding(findings, filePath, lineNumber, "absolute_local_path", "Artifact includes an absolute local path.");
  }

  for (const match of line.matchAll(/https?:\/\/[^\s"')<>]+/g)) {
    if (!isSafeUrl(match[0])) {
      addFinding(findings, filePath, lineNumber, "private_url", "Artifact includes a non-example URL.");
    }
  }

  const quotedCredential = line.match(/"(?:apiKey|api_key|token|secret|password|passphrase)"\s*:\s*"([^"]+)"/i);
  if (quotedCredential && !isPlaceholderCredential(quotedCredential[1])) {
    addFinding(findings, filePath, lineNumber, "credential_value", "Artifact includes a credential-shaped value.");
  }

  const envCredential = line.match(/\b(?:GROCY_API_KEY|API_KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE)=([^\s"']+)/i);
  if (envCredential && !isPlaceholderCredential(envCredential[1])) {
    addFinding(findings, filePath, lineNumber, "credential_value", "Artifact includes a credential-shaped value.");
  }

  if (/\b(?:Stefan|personal-ops|llm-orchestrator|household|pantry-monitoring|shopping intent|calendar integration|task integration)\b/i.test(line)) {
    addFinding(findings, filePath, lineNumber, "private_boundary_term", "Artifact includes a private-boundary term.");
  }
}

export function auditGrocyPublicArtifacts(options: GrocyPublicArtifactRedactionAuditOptions = {}): GrocyPublicArtifactRedactionAudit {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const auditPaths = options.paths && options.paths.length > 0 ? options.paths : DEFAULT_AUDIT_PATHS;
  const files = collectAuditableFiles(baseDir, auditPaths);
  const findings: GrocyPublicArtifactRedactionFinding[] = [];

  for (const file of files) {
    const relativePath = displayPath(baseDir, file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => auditLine(relativePath, line, index + 1, findings));
  }

  return {
    kind: "grocy_public_artifact_redaction_audit",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scannedPaths: auditPaths.map((auditPath) => auditPath.replace(/\\/g, "/")),
    summary: {
      result: findings.length === 0 ? "pass" : "fail",
      scannedFileCount: files.length,
      findingCount: findings.length,
    },
    findings,
  };
}

export function recordGrocyPublicArtifactRedactionAudit(
  audit: GrocyPublicArtifactRedactionAudit,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  const outputPath = path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_PUBLIC_ARTIFACT_REDACTION_AUDIT_PATH);
  if (options.overwrite === false && fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite existing file at ${outputPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  return outputPath;
}
