import fs from "node:fs";
import path from "node:path";
import {
  createGrocyApiCompatibilityMatrix,
  type GrocyApiCompatibilityMatrix,
  type GrocyApiCompatibilityStatus,
} from "./compatibility-matrix.js";
import type { GrocyApiCompatibilitySurface } from "./synthetic-grocy-fixtures.js";

export const GROCY_OBJECT_COVERAGE_PLAYGROUND_PATH = path.join("data", "grocy-object-coverage-playground.json");

export type GrocyObjectCoveragePlaygroundStatus = "covered" | "degraded" | "missing";

export interface GrocyObjectCoveragePlaygroundArtifactScenario {
  id: string;
  label: string;
  fixtureId: string;
  focus: string;
  notes: string[];
}

export interface GrocyObjectCoveragePlaygroundArtifactEntry {
  scenarioId: string;
  fixtureId: string;
  fixtureLabel: string;
  surface: GrocyApiCompatibilitySurface;
  endpoint: string;
  compatibilityStatus: GrocyApiCompatibilityStatus;
  playgroundStatus: GrocyObjectCoveragePlaygroundStatus;
  requiredFields: string[];
  observedFields: string[];
  notes: string[];
}

export interface GrocyObjectCoveragePlaygroundArtifact {
  kind: "grocy_object_coverage_playground";
  version: 1;
  generatedAt: string;
  scope: "synthetic_fixture_only";
  summary: {
    scenarioCount: number;
    fixtureCount: number;
    surfaceCount: number;
    covered: number;
    degraded: number;
    missing: number;
  };
  scenarios: GrocyObjectCoveragePlaygroundArtifactScenario[];
  entries: GrocyObjectCoveragePlaygroundArtifactEntry[];
  reviewNotes: string[];
}

function toPlaygroundStatus(status: GrocyApiCompatibilityStatus): GrocyObjectCoveragePlaygroundStatus {
  if (status === "supported") {
    return "covered";
  }
  if (status === "partial") {
    return "degraded";
  }
  return "missing";
}

function scenarioNotes(fixtureId: string): string[] {
  if (fixtureId === "fixture-current-object-api") {
    return ["Use this scenario when validating the preferred synthetic read path across Grocy stock and object endpoints."];
  }
  if (fixtureId === "fixture-minimal-read-api") {
    return ["Use this scenario to confirm the toolkit still reads core objects when convenience fields are missing."];
  }
  return ["Use this scenario to inspect explicit endpoint gaps without widening the public support claim beyond synthetic fixtures."];
}

function scenarioFocus(fixtureId: string): string {
  if (fixtureId === "fixture-current-object-api") {
    return "Preferred synthetic read coverage for stock, config objects, and shopping-list reads.";
  }
  if (fixtureId === "fixture-minimal-read-api") {
    return "Degraded-but-readable object coverage when optional compatibility fields drop out.";
  }
  return "Explicit missing-surface drill for shopping-list object coverage.";
}

function buildScenarios(matrix: GrocyApiCompatibilityMatrix): GrocyObjectCoveragePlaygroundArtifactScenario[] {
  return matrix.fixtures.map((fixture) => ({
    id: fixture.id.replace(/^fixture-/, "scenario-"),
    label: fixture.label,
    fixtureId: fixture.id,
    focus: scenarioFocus(fixture.id),
    notes: scenarioNotes(fixture.id),
  }));
}

function buildEntries(
  matrix: GrocyApiCompatibilityMatrix,
  scenarios: GrocyObjectCoveragePlaygroundArtifactScenario[],
): GrocyObjectCoveragePlaygroundArtifactEntry[] {
  const scenarioByFixtureId = new Map(scenarios.map((scenario) => [scenario.fixtureId, scenario]));
  const fixtureById = new Map(matrix.fixtures.map((fixture) => [fixture.id, fixture]));

  return matrix.entries.map((entry) => {
    const scenario = scenarioByFixtureId.get(entry.fixtureId);
    const fixture = fixtureById.get(entry.fixtureId);
    if (!scenario || !fixture) {
      throw new Error(`Coverage playground fixture metadata is missing for ${entry.fixtureId}.`);
    }
    return {
      scenarioId: scenario.id,
      fixtureId: entry.fixtureId,
      fixtureLabel: fixture.label,
      surface: entry.surface,
      endpoint: entry.endpoint,
      compatibilityStatus: entry.status,
      playgroundStatus: toPlaygroundStatus(entry.status),
      requiredFields: entry.requiredFields,
      observedFields: entry.observedFields,
      notes: entry.notes,
    };
  });
}

function summarize(
  entries: GrocyObjectCoveragePlaygroundArtifactEntry[],
  scenarioCount: number,
  fixtureCount: number,
): GrocyObjectCoveragePlaygroundArtifact["summary"] {
  return {
    scenarioCount,
    fixtureCount,
    surfaceCount: new Set(entries.map((entry) => entry.surface)).size,
    covered: entries.filter((entry) => entry.playgroundStatus === "covered").length,
    degraded: entries.filter((entry) => entry.playgroundStatus === "degraded").length,
    missing: entries.filter((entry) => entry.playgroundStatus === "missing").length,
  };
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export function createGrocyObjectCoveragePlayground(
  options: { generatedAt?: string } = {},
): GrocyObjectCoveragePlaygroundArtifact {
  const matrix = createGrocyApiCompatibilityMatrix({ generatedAt: options.generatedAt });
  const scenarios = buildScenarios(matrix);
  const entries = buildEntries(matrix, scenarios);

  return {
    kind: "grocy_object_coverage_playground",
    version: 1,
    generatedAt: matrix.generatedAt,
    scope: "synthetic_fixture_only",
    summary: summarize(entries, scenarios.length, matrix.fixtures.length),
    scenarios,
    entries,
    reviewNotes: [
      "This playground is fixture-only and is meant for synthetic object coverage review, not live Grocy certification.",
      "Use it to inspect covered, degraded, and missing object surfaces before making any broader API compatibility claim.",
      "Keep fixture values synthetic and omit personal details, private purchasing workflows, and private operating policy.",
    ],
  };
}

export function recordGrocyObjectCoveragePlayground(
  playground: GrocyObjectCoveragePlaygroundArtifact,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_OBJECT_COVERAGE_PLAYGROUND_PATH),
    playground,
    options.overwrite ?? true,
  );
}
