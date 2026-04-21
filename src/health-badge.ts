import fs from "node:fs";
import path from "node:path";
import {
  createGrocyHealthDiagnosticsArtifact,
  runGrocyHealthDiagnostics,
} from "./health-diagnostics.js";
import {
  GrocyHealthBadgeArtifactSchema,
  type GrocyHealthBadgeArtifact,
  type GrocyHealthDiagnosticCode,
  type GrocyHealthDiagnosticsArtifact,
} from "./schemas.js";

export const GROCY_HEALTH_BADGE_PATH = path.join("data", "grocy-health-badge.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function getComponentCode(input: {
  diagnostics: GrocyHealthDiagnosticsArtifact;
  componentId: "config" | "live_api";
}): GrocyHealthDiagnosticCode | undefined {
  if (input.componentId === "config") {
    return input.diagnostics.diagnostics.find((item) => item.code === "config_missing" || item.code === "config_invalid")?.code;
  }

  return input.diagnostics.diagnostics.find((item) => item.code === "grocy_unreachable")?.code;
}

export function createGrocyHealthBadgeArtifact(input: {
  diagnostics: GrocyHealthDiagnosticsArtifact;
}): GrocyHealthBadgeArtifact {
  const failureCodes = input.diagnostics.diagnostics
    .filter((item) => item.severity === "error")
    .map((item) => item.code);
  const status = failureCodes.length > 0 ? "fail" : "pass";
  const message = failureCodes.length > 0 ? `fail: ${failureCodes.join(",")}` : "pass";
  const components = input.diagnostics.checks.map((check) => ({
    id: check.id,
    status: check.status,
    code: getComponentCode({ diagnostics: input.diagnostics, componentId: check.id }),
  }));

  return GrocyHealthBadgeArtifactSchema.parse({
    kind: "grocy_health_badge",
    version: 1,
    generatedAt: input.diagnostics.generatedAt,
    toolId: input.diagnostics.toolId,
    badge: {
      label: "grocy health",
      message,
      color: status === "pass" ? "green" : "red",
    },
    summary: {
      status,
      failureCodes,
      componentCount: components.length,
    },
    components,
  });
}

export function createGrocyHealthBadgeArtifactFromHealth(input: {
  generatedAt?: string;
  health: Parameters<typeof createGrocyHealthDiagnosticsArtifact>[0]["health"];
  configPath?: string;
}): GrocyHealthBadgeArtifact {
  return createGrocyHealthBadgeArtifact({
    diagnostics: createGrocyHealthDiagnosticsArtifact(input),
  });
}

export async function runGrocyHealthBadge(
  baseDir: string = process.cwd(),
  fetchImpl: typeof fetch = fetch,
  options: { generatedAt?: string; configPath?: string } = {},
): Promise<GrocyHealthBadgeArtifact> {
  return createGrocyHealthBadgeArtifact({
    diagnostics: await runGrocyHealthDiagnostics(baseDir, fetchImpl, options),
  });
}

export function recordGrocyHealthBadgeArtifact(
  artifact: GrocyHealthBadgeArtifact,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_HEALTH_BADGE_PATH),
    artifact,
    options.overwrite ?? true,
  );
}
