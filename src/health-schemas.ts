import { z } from "zod";

export const GrocyHealthDiagnosticCodeSchema = z.enum([
  "config_missing",
  "config_invalid",
  "grocy_unreachable",
  "grocy_reachable",
]);

export const GrocyHealthDiagnosticSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  code: GrocyHealthDiagnosticCodeSchema,
  message: z.string().min(1),
  agentAction: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
});

export const GrocyHealthTriageClassificationSchema = z.enum([
  "healthy",
  "setup_required",
  "repair_required",
  "investigate_live_api",
]);

export const GrocyHealthDiagnosticsArtifactSchema = z.object({
  kind: z.literal("grocy_health_diagnostics"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  toolId: z.literal("grocy"),
  summary: z.object({
    result: z.enum(["pass", "fail"]),
    failureCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
  }),
  checks: z.array(z.object({
    id: z.enum(["config", "live_api"]),
    status: z.enum(["pass", "fail", "skipped"]),
    message: z.string().min(1),
  })).default([]),
  diagnostics: z.array(GrocyHealthDiagnosticSchema).default([]),
  triage: z.object({
    classification: GrocyHealthTriageClassificationSchema,
    severity: z.enum(["info", "error"]),
    summary: z.string().min(1),
  }),
  nextActions: z.array(z.string().min(1)).default([]),
});

export const GrocyHealthBadgeArtifactSchema = z.object({
  kind: z.literal("grocy_health_badge"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  toolId: z.literal("grocy"),
  badge: z.object({
    label: z.literal("grocy health"),
    message: z.string().min(1),
    color: z.enum(["green", "red"]),
  }),
  summary: z.object({
    status: z.enum(["pass", "fail"]),
    failureCodes: z.array(GrocyHealthDiagnosticCodeSchema).default([]),
    componentCount: z.number().int().nonnegative(),
  }),
  components: z
    .array(
      z.object({
        id: z.enum(["config", "live_api"]),
        status: z.enum(["pass", "fail", "skipped"]),
        code: GrocyHealthDiagnosticCodeSchema.optional(),
      }),
    )
    .default([]),
});

export type GrocyHealthDiagnosticCode = z.infer<typeof GrocyHealthDiagnosticCodeSchema>;
export type GrocyHealthDiagnostic = z.infer<typeof GrocyHealthDiagnosticSchema>;
export type GrocyHealthTriageClassification = z.infer<typeof GrocyHealthTriageClassificationSchema>;
export type GrocyHealthDiagnosticsArtifact = z.infer<typeof GrocyHealthDiagnosticsArtifactSchema>;
export type GrocyHealthBadgeArtifact = z.infer<typeof GrocyHealthBadgeArtifactSchema>;
