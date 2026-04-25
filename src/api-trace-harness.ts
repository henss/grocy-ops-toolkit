import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadGrocyLiveConfig } from "./grocy-live.js";
import { GROCY_SCHEMA_CAPTURE_SURFACES } from "./schema-fixture-capture.js";
import { GrocyJsonValueSchema, type GrocyJsonValue } from "./schemas.js";
import {
  DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  getSyntheticGrocyFixture,
  getSyntheticGrocyFixtureResponse,
  type GrocyApiCompatibilitySurface,
} from "./synthetic-grocy-fixtures.js";

export const GROCY_API_TRACE_HARNESS_PATH = path.join("data", "grocy-api-trace-harness.json");

const DEFAULT_REPLAY_BASE_URL = "https://replay.grocy-ops.invalid/api";

const GrocyTraceHeadersSchema = z.record(z.string(), z.string());

export const GrocyApiTraceEntrySchema = z.object({
  surface: z.string().min(1),
  request: z.object({
    method: z.literal("GET"),
    path: z.string().min(1),
    headers: GrocyTraceHeadersSchema,
  }),
  response: z.object({
    statusCode: z.number().int().min(100).max(599),
    headers: GrocyTraceHeadersSchema,
    body: GrocyJsonValueSchema,
  }),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyApiTraceHarnessSchema = z.object({
  kind: z.literal("grocy_api_trace_harness"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  source: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("synthetic_fixture"),
      fixtureId: z.string().min(1),
      fixtureLabel: z.string().min(1),
    }),
    z.object({
      mode: z.literal("live_config"),
      configPath: z.string().min(1),
      redactionMode: z.literal("shape_placeholders"),
    }),
  ]),
  summary: z.object({
    entryCount: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    redactedValueCount: z.number().int().nonnegative(),
  }),
  replay: z.object({
    baseUrl: z.string().min(1),
    supportedPaths: z.array(z.string().min(1)).default([]),
  }),
  entries: z.array(GrocyApiTraceEntrySchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyApiTraceHarness = z.infer<typeof GrocyApiTraceHarnessSchema>;
export type GrocyApiTraceEntry = z.infer<typeof GrocyApiTraceEntrySchema>;

interface LiveTraceEntryResult {
  entry: GrocyApiTraceEntry;
  redactedValueCount: number;
}

function createTraceHeaders(headers?: Record<string, string>): Record<string, string> {
  return {
    accept: "application/json",
    ...(headers ?? {}),
  };
}

function createSyntheticTraceEntry(
  surface: GrocyApiCompatibilitySurface,
  endpoint: string,
  fixtureId: string,
): GrocyApiTraceEntry {
  const payload = getSyntheticGrocyFixtureResponse(fixtureId, endpoint);
  if (payload === undefined) {
    return GrocyApiTraceEntrySchema.parse({
      surface,
      request: {
        method: "GET",
        path: endpoint,
        headers: createTraceHeaders(),
      },
      response: {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: { error: "Synthetic fixture endpoint not found." },
      },
      reviewNotes: ["Synthetic fixtures keep unsupported surfaces explicit with a 404 replay response."],
    });
  }

  return GrocyApiTraceEntrySchema.parse({
    surface,
    request: {
      method: "GET",
      path: endpoint,
      headers: createTraceHeaders(),
    },
    response: {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: payload,
    },
    reviewNotes: ["Synthetic trace bodies use the repo's public-safe fixture values."],
  });
}

function redactString(value: string, count: number): string {
  if (value.length === 0) {
    return "";
  }
  if (/^\d+$/.test(value)) {
    return `<redacted-id-${count}>`;
  }
  if (/^\d{4}-\d{2}-\d{2}(?:[tT ].*)?$/.test(value)) {
    return `<redacted-date-${count}>`;
  }
  return `<redacted-string-${count}>`;
}

function redactJsonValue(value: unknown, state: { count: number }): GrocyJsonValue {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    state.count += 1;
    return 0;
  }
  if (typeof value === "string") {
    state.count += 1;
    return redactString(value, state.count);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item, state));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, redactJsonValue(nested, state)]),
    );
  }

  state.count += 1;
  return `<redacted-unsupported-${state.count}>`;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

async function createLiveTraceEntry(
  baseDir: string,
  endpoint: string,
  surface: GrocyApiCompatibilitySurface,
  options: { configPath?: string; fetchImpl?: typeof fetch },
): Promise<LiveTraceEntryResult> {
  const config = loadGrocyLiveConfig(baseDir, options.configPath);
  if (!config) {
    throw new Error(`No Grocy live config found at ${path.resolve(baseDir, options.configPath ?? path.join("config", "grocy.local.json"))}.`);
  }

  const response = await (options.fetchImpl ?? fetch)(`${config.baseUrl}${endpoint}`, {
    headers: {
      "GROCY-API-KEY": config.apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const body = response.status === 404 ? { error: "Grocy endpoint not found." } : await readJsonResponse(response);
  const redactionState = { count: 0 };

  return {
    entry: GrocyApiTraceEntrySchema.parse({
      surface,
      request: {
        method: "GET",
        path: endpoint,
        headers: createTraceHeaders({ "grocy-api-key": "<redacted>" }),
      },
      response: {
        statusCode: response.status,
        headers: {
          "content-type": response.headers.get("content-type") ?? "application/json",
        },
        body: redactJsonValue(body, redactionState),
      },
      reviewNotes: [
        "Live traces redact all response values into shape-preserving placeholders before serialization.",
        "The artifact omits base URLs, API keys, and raw Grocy record values.",
      ],
    }),
    redactedValueCount: redactionState.count,
  };
}

function summarizeEntries(entries: GrocyApiTraceEntry[], redactedValueCount: number): GrocyApiTraceHarness["summary"] {
  return {
    entryCount: entries.length,
    successCount: entries.filter((entry) => entry.response.statusCode >= 200 && entry.response.statusCode < 300).length,
    missingCount: entries.filter((entry) => entry.response.statusCode === 404).length,
    redactedValueCount,
  };
}

export function createGrocyApiTraceHarnessFromSyntheticFixture(
  fixtureId: string = DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  options: { generatedAt?: string; replayBaseUrl?: string } = {},
): GrocyApiTraceHarness {
  const fixture = getSyntheticGrocyFixture(fixtureId);
  const entries = GROCY_SCHEMA_CAPTURE_SURFACES.map((surface) =>
    createSyntheticTraceEntry(surface.surface, surface.endpoint, fixture.id),
  );

  return GrocyApiTraceHarnessSchema.parse({
    kind: "grocy_api_trace_harness",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      mode: "synthetic_fixture",
      fixtureId: fixture.id,
      fixtureLabel: fixture.label,
    },
    summary: summarizeEntries(entries, 0),
    replay: {
      baseUrl: options.replayBaseUrl ?? DEFAULT_REPLAY_BASE_URL,
      supportedPaths: entries.map((entry) => `/api${entry.request.path}`),
    },
    entries,
    reviewNotes: [
      "Synthetic traces are the safest bug-report artifact because they replay from public-safe fixture values.",
      "When a live Grocy instance is needed, use the live capture mode and review the redacted placeholders before sharing.",
    ],
  });
}

export async function createGrocyApiTraceHarnessFromLiveConfig(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string; configPath?: string; fetchImpl?: typeof fetch; replayBaseUrl?: string } = {},
): Promise<GrocyApiTraceHarness> {
  const results = await Promise.all(
    GROCY_SCHEMA_CAPTURE_SURFACES.map(async (surface) =>
      createLiveTraceEntry(baseDir, surface.endpoint, surface.surface, options),
    ),
  );
  const entries = results.map((result) => result.entry);
  const redactedValueCount = results.reduce((sum, result) => sum + result.redactedValueCount, 0);

  return GrocyApiTraceHarnessSchema.parse({
    kind: "grocy_api_trace_harness",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      mode: "live_config",
      configPath: options.configPath ?? path.join("config", "grocy.local.json"),
      redactionMode: "shape_placeholders",
    },
    summary: summarizeEntries(entries, redactedValueCount),
    replay: {
      baseUrl: options.replayBaseUrl ?? DEFAULT_REPLAY_BASE_URL,
      supportedPaths: entries.map((entry) => `/api${entry.request.path}`),
    },
    entries,
    reviewNotes: [
      "This prototype is intended for redacted bug-report reproduction, not for full-fidelity archival.",
      "Replay adapters can exercise status codes, field presence, and shape-sensitive parsing without serializing private Grocy values.",
    ],
  });
}

export function createGrocyReplayFetch(trace: GrocyApiTraceHarness): typeof fetch {
  const entryMap = new Map(trace.entries.map((entry) => [`${entry.request.method} ${entry.request.path}`, entry]));

  return (async (input: string | URL | Request) => {
    const request = input instanceof Request ? input : undefined;
    const method = request?.method ?? "GET";
    const url = new URL(String(request?.url ?? input), trace.replay.baseUrl);
    const relativePath = url.pathname.replace(/^\/api/, "") || "/";
    const entry = entryMap.get(`${method} ${relativePath}`);

    if (!entry) {
      return new Response(JSON.stringify({ error: "Recorded trace entry not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(entry.response.body), {
      status: entry.response.statusCode,
      headers: entry.response.headers,
    });
  }) as typeof fetch;
}

export function recordGrocyApiTraceHarness(
  trace: GrocyApiTraceHarness,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  const outputPath = path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_API_TRACE_HARNESS_PATH);
  if (options.overwrite === false && fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite existing file at ${outputPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  return outputPath;
}
