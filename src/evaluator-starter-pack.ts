import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  createGrocyReadmeQuickstartProofReceipt,
  GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH,
  recordGrocyReadmeQuickstartProofReceipt,
} from "./quickstart-proof.js";
import { GrocyReadmeQuickstartProofReceiptSchema } from "./quickstart-proof-schema.js";
import { GROCY_DEMO_ENVIRONMENT_PATH } from "./demo-lab.js";
import { GROCY_SUPPORT_BUNDLE_PATH, GrocySupportBundleSchema } from "./support-bundle.js";

export const GROCY_EVALUATOR_STARTER_PACK_COMMAND = "npm run grocy:evaluator:starter-pack";
export const GROCY_EVALUATOR_STARTER_PACK_PATH = path.join("data", "grocy-evaluator-starter-pack.json");

const GROCY_EVALUATOR_STARTER_PACK_DOCS = [
  {
    id: "starter_pack",
    title: "Synthetic Evaluator Starter Pack",
    path: "docs/synthetic-evaluator-starter-pack.md",
    purpose: "Fastest evaluator-facing walkthrough for the synthetic toolkit surface.",
  },
  {
    id: "demo_lab",
    title: "Synthetic Grocy Demo Lab",
    path: "docs/synthetic-demo-lab.md",
    purpose: "Underlying one-command synthetic demo workflow and artifact families.",
  },
  {
    id: "fixture_gallery",
    title: "Quickstart Fixture Gallery",
    path: "docs/quickstart-fixture-gallery.md",
    purpose: "Smaller fixture families and follow-on commands after the starter pack run.",
  },
] as const;

const GROCY_EVALUATOR_STARTER_PACK_EXAMPLES = [
  "examples/grocy-evaluator-starter-pack.example.json",
  "examples/grocy-quickstart-proof-receipt.example.json",
  "examples/grocy-support-bundle.example.json",
  "examples/grocy-review-dashboard.example.md",
] as const;

const GrocyEvaluatorStarterPackEntrypointSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1),
  description: z.string().min(1),
});

const GrocyEvaluatorStarterPackDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1),
  purpose: z.string().min(1),
});

export const GrocyEvaluatorStarterPackSchema = z.object({
  kind: z.literal("grocy_evaluator_starter_pack"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  summary: z.object({
    status: z.enum(["pass", "fail"]),
    shareability: z.enum(["ready_to_share", "needs_redaction_review"]),
    artifactCount: z.number().int().nonnegative(),
    recommendedReadingCount: z.number().int().nonnegative(),
  }),
  command: z.object({
    id: z.literal("grocy:evaluator:starter-pack"),
    cli: z.literal(GROCY_EVALUATOR_STARTER_PACK_COMMAND),
  }),
  entrypoints: z.array(GrocyEvaluatorStarterPackEntrypointSchema),
  docs: z.array(GrocyEvaluatorStarterPackDocSchema),
  exampleArtifacts: z.array(z.string().min(1)),
  verification: z.array(z.string().min(1)),
  reviewNotes: z.array(z.string().min(1)),
});

export type GrocyEvaluatorStarterPack = z.infer<typeof GrocyEvaluatorStarterPackSchema>;

function writeJsonFile(filePath: string, value: unknown, overwrite = true): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function readJsonFile<T>(baseDir: string, relativePath: string, schema: z.ZodType<T>): T {
  const absolutePath = path.resolve(baseDir, relativePath);
  return schema.parse(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown);
}

const GrocyDemoEnvironmentReportSchema = z.object({
  artifacts: z.object({
    reviewDashboardPath: z.string().min(1),
    supportBundlePath: z.string().min(1),
  }),
});

export function recordGrocyEvaluatorStarterPack(
  starterPack: GrocyEvaluatorStarterPack,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_EVALUATOR_STARTER_PACK_PATH),
    starterPack,
    options.overwrite ?? true,
  );
}

export async function createGrocyEvaluatorStarterPack(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string } = {},
): Promise<GrocyEvaluatorStarterPack> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const quickstartProof = await createGrocyReadmeQuickstartProofReceipt(baseDir, { generatedAt });
  recordGrocyReadmeQuickstartProofReceipt(quickstartProof, {
    baseDir,
    outputPath: GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH,
    overwrite: true,
  });
  const demoEnvironment = readJsonFile(
    baseDir,
    GROCY_DEMO_ENVIRONMENT_PATH,
    GrocyDemoEnvironmentReportSchema,
  );
  const supportBundle = readJsonFile(baseDir, demoEnvironment.artifacts.supportBundlePath, GrocySupportBundleSchema);

  return GrocyEvaluatorStarterPackSchema.parse({
    kind: "grocy_evaluator_starter_pack",
    version: 1,
    generatedAt,
    scope: "synthetic_fixture_only",
    summary: {
      status: quickstartProof.summary.status,
      shareability: supportBundle.summary.readiness,
      artifactCount: 4,
      recommendedReadingCount: GROCY_EVALUATOR_STARTER_PACK_DOCS.length,
    },
    command: {
      id: "grocy:evaluator:starter-pack",
      cli: GROCY_EVALUATOR_STARTER_PACK_COMMAND,
    },
    entrypoints: [
      {
        id: "starter_pack_receipt",
        title: "Evaluator starter pack receipt",
        path: GROCY_EVALUATOR_STARTER_PACK_PATH.replace(/\\/g, "/"),
        description: "Compact machine-readable map of the synthetic evaluator surface.",
      },
      {
        id: "quickstart_proof",
        title: "README quickstart proof",
        path: GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH.replace(/\\/g, "/"),
        description: "Proof that the public quickstart recipes still regenerate synthetic artifacts end to end.",
      },
      {
        id: "review_dashboard",
        title: "Synthetic review dashboard",
        path: demoEnvironment.artifacts.reviewDashboardPath,
        description: "Human-readable Markdown summary across diagnostics, config review, smoke, and backup evidence.",
      },
      {
        id: "support_bundle",
        title: "Sanitized support bundle",
        path: demoEnvironment.artifacts.supportBundlePath,
        description: "Shareability-oriented manifest with checksums and redaction-audit status for the main demo artifacts.",
      },
    ],
    docs: [...GROCY_EVALUATOR_STARTER_PACK_DOCS],
    exampleArtifacts: [...GROCY_EVALUATOR_STARTER_PACK_EXAMPLES],
    verification: [
      "npm run typecheck",
      "npm run build",
      "npm test",
    ],
    reviewNotes: [
      "This starter pack stays inside the synthetic-only boundary and does not require live Grocy credentials.",
      "The command reuses the README quickstart proof so evaluators can trust the same public recipes that the docs advertise.",
      "Use the review dashboard first for a short human pass, then inspect the quickstart proof receipt and support bundle for machine-readable evidence.",
      "The raw encrypted backup archive stays outside the starter-pack surface; the shareable path is the support bundle plus the referenced proof artifacts.",
    ],
  });
}
