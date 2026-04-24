import { z } from "zod";

export const GrocyConfigEntitySchema = z.enum([
  "products",
  "product_groups",
  "locations",
  "quantity_units",
  "product_barcodes",
  "shopping_lists",
  "shopping_list",
]);

export const GrocyConfigOwnershipSchema = z.enum([
  "repo_managed",
  "grocy_managed",
  "observed_only",
]);

export const GrocyJsonScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type GrocyJsonValue =
  | z.infer<typeof GrocyJsonScalarSchema>
  | GrocyJsonValue[]
  | { [key: string]: GrocyJsonValue };

export const GrocyJsonValueSchema: z.ZodType<GrocyJsonValue> = z.lazy(() =>
  z.union([
    GrocyJsonScalarSchema,
    z.array(GrocyJsonValueSchema),
    z.record(z.string(), GrocyJsonValueSchema),
  ]),
);

export const GrocyConfigProvenanceSchema = z.object({
  source: z.string().min(1),
  recordedAt: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyConfigItemSchema = z.object({
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema.default("repo_managed"),
  fields: z.record(z.string(), GrocyJsonValueSchema).default({}),
  aliases: z.array(z.string().min(1)).default([]),
  provenance: GrocyConfigProvenanceSchema,
  lastObservedLiveId: z.string().min(1).optional(),
  lastObservedAt: z.string().min(1).optional(),
});

export const GrocyConfigManifestSchema = z.object({
  kind: z.literal("grocy_config_manifest"),
  version: z.literal(1),
  updatedAt: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
  items: z.array(GrocyConfigItemSchema).default([]),
});

export const GrocyDesiredStateLintSeveritySchema = z.enum(["error", "warning"]);

export const GrocyDesiredStateLintFindingSchema = z.object({
  severity: GrocyDesiredStateLintSeveritySchema,
  code: z.enum([
    "duplicate_item_key",
    "duplicate_match_candidate",
    "duplicate_alias",
    "volatile_field_declared",
  ]),
  message: z.string().min(1),
  itemKey: z.string().min(1).optional(),
  path: z.string().min(1),
});

export const GrocyDesiredStateManifestLintReportSchema = z.object({
  kind: z.literal("grocy_desired_state_manifest_lint_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  manifestPath: z.string().min(1),
  summary: z.object({
    itemCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    ready: z.boolean(),
  }),
  findings: z.array(GrocyDesiredStateLintFindingSchema).default([]),
});

export const GrocyConfigExportSchema = z.object({
  kind: z.literal("grocy_config_export"),
  version: z.literal(1),
  exportedAt: z.string().min(1),
  source: z.object({
    toolId: z.literal("grocy"),
    baseUrl: z.string().min(1).optional(),
    grocyVersion: z.string().min(1).optional(),
  }),
  counts: z.record(GrocyConfigEntitySchema, z.number().int().nonnegative()),
  items: z.array(GrocyConfigItemSchema).default([]),
});

export const GrocyConfigPlanActionSchema = z.enum([
  "create",
  "update",
  "noop",
  "manual_review",
]);

export const GrocyConfigPlanChangeSchema = z.object({
  field: z.string().min(1),
  desired: GrocyJsonValueSchema.optional(),
  live: GrocyJsonValueSchema.optional(),
});

export const GrocyConfigPlanItemSchema = z.object({
  action: GrocyConfigPlanActionSchema,
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema,
  liveId: z.string().min(1).optional(),
  reason: z.string().min(1),
  changes: z.array(GrocyConfigPlanChangeSchema).default([]),
  desired: GrocyConfigItemSchema.optional(),
  live: GrocyConfigItemSchema.optional(),
});

export const GrocyConfigSyncPlanSchema = z.object({
  kind: z.literal("grocy_config_sync_plan"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  manifestPath: z.string().min(1),
  exportPath: z.string().min(1).optional(),
  actions: z.array(GrocyConfigPlanItemSchema).default([]),
  summary: z.object({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    noop: z.number().int().nonnegative(),
    manualReview: z.number().int().nonnegative(),
  }),
});

export const GrocyConfigApplyDryRunReportItemSchema = z.object({
  action: z.enum(["would_create", "would_update", "skipped", "manual_review"]),
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema,
  liveId: z.string().min(1).optional(),
  reason: z.string().min(1),
  changes: z.array(GrocyConfigPlanChangeSchema).default([]),
});

export const GrocyConfigApplyDryRunReportSchema = z.object({
  kind: z.literal("grocy_config_apply_dry_run_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  planPath: z.string().min(1),
  summary: z.object({
    wouldCreate: z.number().int().nonnegative(),
    wouldUpdate: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    manualReview: z.number().int().nonnegative(),
  }),
  items: z.array(GrocyConfigApplyDryRunReportItemSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyConfigDriftTrendStatusSchema = z.enum(["added", "removed", "changed"]);

export const GrocyConfigDriftTrendChangeSchema = z.object({
  field: z.string().min(1),
  previous: GrocyJsonValueSchema.optional(),
  current: GrocyJsonValueSchema.optional(),
});

export const GrocyConfigDriftTrendItemSchema = z.object({
  status: GrocyConfigDriftTrendStatusSchema,
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  changedFields: z.array(z.string().min(1)).default([]),
  changes: z.array(GrocyConfigDriftTrendChangeSchema).default([]),
});

export const GrocyConfigDriftTrendReportSchema = z.object({
  kind: z.literal("grocy_config_drift_trend_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  previousExportPath: z.string().min(1),
  currentExportPath: z.string().min(1),
  period: z.object({
    previousExportedAt: z.string().min(1),
    currentExportedAt: z.string().min(1),
  }),
  summary: z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  }),
  entityBreakdown: z.record(
    GrocyConfigEntitySchema,
    z.object({
      added: z.number().int().nonnegative(),
      removed: z.number().int().nonnegative(),
      changed: z.number().int().nonnegative(),
      unchanged: z.number().int().nonnegative(),
    }),
  ),
  items: z.array(GrocyConfigDriftTrendItemSchema).default([]),
});

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

export const GrocyInstallDoctorCheckSchema = z.object({
  id: z.enum([
    "node_version",
    "config_dir",
    "data_dir",
    "restore_dir",
    "grocy_config",
    "backup_config",
    "backup_source",
  ]),
  status: z.enum(["pass", "warn", "fail", "skipped"]),
  code: z.enum([
    "node_version_supported",
    "node_version_unreadable",
    "node_version_unsupported",
    "directory_ready",
    "directory_missing",
    "directory_invalid",
    "grocy_config_ready",
    "grocy_config_missing",
    "grocy_config_invalid",
    "backup_config_ready",
    "backup_config_missing",
    "backup_config_invalid",
    "backup_source_ready",
    "backup_source_missing",
    "backup_source_skipped",
  ]),
  message: z.string().min(1),
  action: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
});

export const GrocyInstallDoctorArtifactSchema = z.object({
  kind: z.literal("grocy_install_doctor"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  toolId: z.literal("grocy"),
  summary: z.object({
    status: z.enum(["ready", "action_required"]),
    failureCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    passCount: z.number().int().nonnegative(),
  }),
  checks: z.array(GrocyInstallDoctorCheckSchema).default([]),
  nextActions: z.array(z.string().min(1)).default([]),
});

export const GrocyToolkitRunReceiptSchema = z.object({
  kind: z.literal("grocy_toolkit_run_receipt"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  command: z.object({
    id: z.literal("grocy:smoke:mock"),
    cli: z.literal("npm run grocy:smoke:mock"),
  }),
  fixtureSet: z.object({
    id: z.literal("synthetic_mock_smoke"),
    scope: z.literal("synthetic_fixture_only"),
    notes: z.array(z.string().min(1)).default([]),
  }),
  artifacts: z.array(z.object({
    role: z.enum(["primary_report", "derived_plan", "derived_dry_run_report"]),
    kind: z.enum([
      "grocy_mock_smoke_report",
      "grocy_config_sync_plan",
      "grocy_config_apply_dry_run_report",
    ]),
    path: z.string().min(1),
  })).default([]),
  verification: z.object({
    command: z.literal("npm run grocy:smoke:mock"),
    status: z.enum(["pass", "fail"]),
  }),
  result: z.object({
    status: z.enum(["pass", "fail"]),
    checkCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
  }),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyObjectCoveragePlaygroundScenarioSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fixtureId: z.string().min(1),
  focus: z.string().min(1),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyObjectCoveragePlaygroundEntrySchema = z.object({
  scenarioId: z.string().min(1),
  fixtureId: z.string().min(1),
  fixtureLabel: z.string().min(1),
  surface: z.enum([
    "system_info",
    "stock",
    "products",
    "product_groups",
    "locations",
    "quantity_units",
    "product_barcodes",
    "shopping_lists",
    "shopping_list",
  ]),
  endpoint: z.string().min(1),
  compatibilityStatus: z.enum(["supported", "partial", "unsupported"]),
  playgroundStatus: z.enum(["covered", "degraded", "missing"]),
  requiredFields: z.array(z.string().min(1)).default([]),
  observedFields: z.array(z.string().min(1)).default([]),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyObjectCoveragePlaygroundSchema = z.object({
  kind: z.literal("grocy_object_coverage_playground"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  summary: z.object({
    scenarioCount: z.number().int().nonnegative(),
    fixtureCount: z.number().int().nonnegative(),
    surfaceCount: z.number().int().nonnegative(),
    covered: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
  }),
  scenarios: z.array(GrocyObjectCoveragePlaygroundScenarioSchema).default([]),
  entries: z.array(GrocyObjectCoveragePlaygroundEntrySchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRestoreFailureCategorySchema = z.enum([
  "archive_unreadable",
  "archive_format_unsupported",
  "archive_decryption_failed",
  "manifest_checksum_mismatch",
  "bundle_file_checksum_mismatch",
  "restore_write_unconfirmed",
  "restore_path_escape",
  "restore_write_failed",
]);

export const GrocyBackupRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  sourcePath: z.string().min(1),
  archivePath: z.string().min(1),
  locationLabel: z.string().min(1),
  checksumSha256: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  grocyVersion: z.string().min(1).optional(),
  restoreTestStatus: z.enum(["not_tested", "verified", "failed"]).default("not_tested"),
  restoreTestedAt: z.string().min(1).optional(),
  restoreFailureCategory: GrocyBackupRestoreFailureCategorySchema.optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupManifestSchema = z.object({
  kind: z.literal("grocy_backup_manifest"),
  version: z.literal(1),
  updatedAt: z.string().min(1),
  records: z.array(GrocyBackupRecordSchema).default([]),
});

export const GrocyBackupRestorePlanDryRunReportItemSchema = z.object({
  action: z.enum(["would_create", "would_overwrite", "blocked_path_escape"]),
  path: z.string().min(1),
  targetPath: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().min(1),
  reason: z.string().min(1),
});

export const GrocyBackupRestorePlanDryRunReportSchema = z.object({
  kind: z.literal("grocy_backup_restore_plan_dry_run_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  archivePath: z.string().min(1),
  archiveRecordId: z.string().min(1).optional(),
  restoreDir: z.string().min(1),
  summary: z.object({
    result: z.enum(["ready", "blocked"]),
    checksumVerified: z.boolean(),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    wouldCreate: z.number().int().nonnegative(),
    wouldOverwrite: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
  notes: z.array(z.string().min(1)).default([]),
  items: z.array(GrocyBackupRestorePlanDryRunReportItemSchema).default([]),
});

export const GrocyBackupRestoreDrillCheckpointSchema = z.object({
  id: z.enum([
    "snapshot_created",
    "restore_plan_ready",
    "restore_verification_succeeded",
  ]),
  status: z.enum(["pass", "fail"]),
  command: z.string().min(1),
  artifactPath: z.string().min(1).optional(),
  evidence: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRestoreDrillReportSchema = z.object({
  kind: z.literal("grocy_backup_restore_drill_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  sourcePath: z.string().min(1),
  restoreDir: z.string().min(1),
  summary: z.object({
    result: z.enum(["pass", "fail"]),
    checkpointCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    wouldCreate: z.number().int().nonnegative(),
    wouldOverwrite: z.number().int().nonnegative(),
  }),
  checkpoints: z.array(GrocyBackupRestoreDrillCheckpointSchema).default([]),
  artifacts: z.object({
    manifestPath: z.string().min(1),
    restorePlanReportPath: z.string().min(1),
  }),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyConfigEntity = z.infer<typeof GrocyConfigEntitySchema>;
export type GrocyConfigOwnership = z.infer<typeof GrocyConfigOwnershipSchema>;
export type GrocyConfigProvenance = z.infer<typeof GrocyConfigProvenanceSchema>;
export type GrocyConfigItem = z.infer<typeof GrocyConfigItemSchema>;
export type GrocyConfigManifest = z.infer<typeof GrocyConfigManifestSchema>;
export type GrocyDesiredStateLintSeverity = z.infer<typeof GrocyDesiredStateLintSeveritySchema>;
export type GrocyDesiredStateLintFinding = z.infer<typeof GrocyDesiredStateLintFindingSchema>;
export type GrocyDesiredStateManifestLintReport = z.infer<typeof GrocyDesiredStateManifestLintReportSchema>;
export type GrocyConfigExport = z.infer<typeof GrocyConfigExportSchema>;
export type GrocyConfigPlanAction = z.infer<typeof GrocyConfigPlanActionSchema>;
export type GrocyConfigPlanChange = z.infer<typeof GrocyConfigPlanChangeSchema>;
export type GrocyConfigPlanItem = z.infer<typeof GrocyConfigPlanItemSchema>;
export type GrocyConfigSyncPlan = z.infer<typeof GrocyConfigSyncPlanSchema>;
export type GrocyConfigApplyDryRunReportItem = z.infer<typeof GrocyConfigApplyDryRunReportItemSchema>;
export type GrocyConfigApplyDryRunReport = z.infer<typeof GrocyConfigApplyDryRunReportSchema>;
export type GrocyConfigDriftTrendStatus = z.infer<typeof GrocyConfigDriftTrendStatusSchema>;
export type GrocyConfigDriftTrendChange = z.infer<typeof GrocyConfigDriftTrendChangeSchema>;
export type GrocyConfigDriftTrendItem = z.infer<typeof GrocyConfigDriftTrendItemSchema>;
export type GrocyConfigDriftTrendReport = z.infer<typeof GrocyConfigDriftTrendReportSchema>;
export type GrocyHealthDiagnosticCode = z.infer<typeof GrocyHealthDiagnosticCodeSchema>;
export type GrocyHealthDiagnostic = z.infer<typeof GrocyHealthDiagnosticSchema>;
export type GrocyHealthDiagnosticsArtifact = z.infer<typeof GrocyHealthDiagnosticsArtifactSchema>;
export type GrocyHealthBadgeArtifact = z.infer<typeof GrocyHealthBadgeArtifactSchema>;
export type GrocyInstallDoctorCheck = z.infer<typeof GrocyInstallDoctorCheckSchema>;
export type GrocyInstallDoctorArtifact = z.infer<typeof GrocyInstallDoctorArtifactSchema>;
export type GrocyToolkitRunReceipt = z.infer<typeof GrocyToolkitRunReceiptSchema>;
export type GrocyObjectCoveragePlaygroundScenario = z.infer<typeof GrocyObjectCoveragePlaygroundScenarioSchema>;
export type GrocyObjectCoveragePlaygroundEntry = z.infer<typeof GrocyObjectCoveragePlaygroundEntrySchema>;
export type GrocyObjectCoveragePlayground = z.infer<typeof GrocyObjectCoveragePlaygroundSchema>;
export type GrocyBackupRestoreFailureCategory = z.infer<typeof GrocyBackupRestoreFailureCategorySchema>;
export type GrocyBackupRecord = z.infer<typeof GrocyBackupRecordSchema>;
export type GrocyBackupManifest = z.infer<typeof GrocyBackupManifestSchema>;
export type GrocyBackupRestorePlanDryRunReportItem = z.infer<typeof GrocyBackupRestorePlanDryRunReportItemSchema>;
export type GrocyBackupRestorePlanDryRunReport = z.infer<typeof GrocyBackupRestorePlanDryRunReportSchema>;
export type GrocyBackupRestoreDrillCheckpoint = z.infer<typeof GrocyBackupRestoreDrillCheckpointSchema>;
export type GrocyBackupRestoreDrillReport = z.infer<typeof GrocyBackupRestoreDrillReportSchema>;
