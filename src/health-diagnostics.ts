import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_GROCY_CONFIG_PATH,
  getGrocyConfigStatus,
  runGrocyHealthCheck,
  type GrocyHealthCheckResult,
} from "./grocy-live.js";
import {
  GrocyHealthDiagnosticsArtifactSchema,
  type GrocyHealthDiagnostic,
  type GrocyHealthDiagnosticsArtifact,
} from "./schemas.js";

export const GROCY_HEALTH_DIAGNOSTICS_PATH = path.join("data", "grocy-health-diagnostics.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function sanitizeEvidence(value: string): string {
  return value
    .replace(/[A-Za-z]:\\[^\s"]+/g, "<local-path>")
    .replace(/https?:\/\/[^\s"]+/g, "<url>")
    .replace(/GROCY-API-KEY[^\s"]*/gi, "GROCY-API-KEY <redacted>")
    .slice(0, 240);
}

function isMissingConfig(result: GrocyHealthCheckResult): boolean {
  return result.status.notes.some((note) => /No Grocy live config found/i.test(note));
}

function isInvalidConfig(result: GrocyHealthCheckResult): boolean {
  return result.status.notes.some((note) => /Grocy config|JSON/i.test(note)) && !isMissingConfig(result);
}

function createDiagnostics(input: {
  health: GrocyHealthCheckResult;
  configPath: string;
}): GrocyHealthDiagnostic[] {
  if (isMissingConfig(input.health)) {
    return [
      {
        severity: "error",
        code: "config_missing",
        message: `Grocy live config was not found at ${input.configPath}.`,
        agentAction: "Create a local config from examples/grocy.local.example.json, then rerun npm run grocy:health:diagnostics.",
        evidence: [],
      },
    ];
  }

  if (isInvalidConfig(input.health)) {
    return [
      {
        severity: "error",
        code: "config_invalid",
        message: `Grocy live config at ${input.configPath} could not be parsed or validated.`,
        agentAction: "Compare the local config with examples/grocy.local.example.json, then rerun npm run grocy:health:diagnostics.",
        evidence: input.health.status.notes.map(sanitizeEvidence).filter(Boolean),
      },
    ];
  }

  if (!input.health.status.reachable) {
    return [
      {
        severity: "error",
        code: "grocy_unreachable",
        message: "Grocy live adapter check failed before all read probes completed.",
        agentAction: "Verify local config, Grocy availability, and API-key permissions, then rerun npm run grocy:health:diagnostics.",
        evidence: input.health.status.notes.map(sanitizeEvidence).filter(Boolean),
      },
    ];
  }

  return [
    {
      severity: "info",
      code: "grocy_reachable",
      message: "Grocy live adapter completed its read probes.",
      agentAction: "No immediate agent action is required.",
      evidence: [],
    },
  ];
}

export function createGrocyHealthDiagnosticsArtifact(input: {
  health: GrocyHealthCheckResult;
  generatedAt?: string;
  configPath?: string;
}): GrocyHealthDiagnosticsArtifact {
  const configPath = input.configPath ?? DEFAULT_GROCY_CONFIG_PATH;
  const diagnostics = createDiagnostics({ health: input.health, configPath });
  const failureCount = diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
  const missingConfig = diagnostics.some((item) => item.code === "config_missing");
  const invalidConfig = diagnostics.some((item) => item.code === "config_invalid");

  return GrocyHealthDiagnosticsArtifactSchema.parse({
    kind: "grocy_health_diagnostics",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    toolId: "grocy",
    summary: {
      result: failureCount > 0 ? "fail" : "pass",
      failureCount,
      warningCount,
    },
    checks: [
      {
        id: "config",
        status: missingConfig || invalidConfig ? "fail" : "pass",
        message: missingConfig
          ? `Local Grocy config is missing at ${configPath}.`
          : invalidConfig
            ? `Local Grocy config at ${configPath} is invalid.`
            : `Local Grocy config is present at ${configPath}.`,
      },
      {
        id: "live_api",
        status: missingConfig || invalidConfig ? "skipped" : input.health.status.reachable ? "pass" : "fail",
        message: missingConfig || invalidConfig
          ? "Live API probes were skipped because local config is unavailable."
          : input.health.status.reachable
            ? "Live API read probes completed."
            : "Live API read probes did not complete.",
      },
    ],
    diagnostics,
  });
}

export async function runGrocyHealthDiagnostics(
  baseDir: string = process.cwd(),
  fetchImpl: typeof fetch = fetch,
  options: { generatedAt?: string; configPath?: string } = {},
): Promise<GrocyHealthDiagnosticsArtifact> {
  const configPath = options.configPath ?? DEFAULT_GROCY_CONFIG_PATH;
  let health: GrocyHealthCheckResult;
  try {
    const configStatus = getGrocyConfigStatus(baseDir, configPath);
    health = configStatus.notes.some((note) => /No Grocy live config found/i.test(note))
      ? { status: configStatus }
      : await runGrocyHealthCheck(baseDir, fetchImpl, { configPath });
  } catch (error) {
    health = {
      status: {
        toolId: "grocy",
        reachable: false,
        mode: "write_enabled",
        notes: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
  return createGrocyHealthDiagnosticsArtifact({
    health,
    generatedAt: options.generatedAt,
    configPath,
  });
}

export function recordGrocyHealthDiagnosticsArtifact(
  artifact: GrocyHealthDiagnosticsArtifact,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_HEALTH_DIAGNOSTICS_PATH),
    artifact,
    options.overwrite ?? true,
  );
}
