import type {
  GrocyHealthDiagnostic,
  GrocyHealthDiagnosticsArtifact,
  GrocyHealthTriageClassification,
} from "./schemas.js";

export interface GrocyHealthTriageDecision {
  classification: GrocyHealthTriageClassification;
  severity: GrocyHealthDiagnosticsArtifact["triage"]["severity"];
  summary: string;
  nextActions: string[];
}

function hasDiagnosticCode(diagnostics: GrocyHealthDiagnostic[], code: GrocyHealthDiagnostic["code"]): boolean {
  return diagnostics.some((item) => item.code === code);
}

export function classifyGrocyHealthTriage(diagnostics: GrocyHealthDiagnostic[]): GrocyHealthTriageDecision {
  if (hasDiagnosticCode(diagnostics, "config_missing")) {
    return {
      classification: "setup_required",
      severity: "error",
      summary: "Local Grocy config is missing, so live health checks cannot run yet.",
      nextActions: [
        "Run npm run grocy:init:workspace if the conventional local directories or starter config files are missing.",
        "Copy examples/grocy.local.example.json to config/grocy.local.json and set baseUrl plus apiKey for the local Grocy instance.",
        "Rerun npm run grocy:health:diagnostics after the local config is in place.",
      ],
    };
  }

  if (hasDiagnosticCode(diagnostics, "config_invalid")) {
    return {
      classification: "repair_required",
      severity: "error",
      summary: "Local Grocy config exists but fails validation, so live probes are not safe to trust yet.",
      nextActions: [
        "Compare config/grocy.local.json with examples/grocy.local.example.json.",
        "Fix the validation errors listed in the diagnostics evidence before changing anything else.",
        "Rerun npm run grocy:health:diagnostics after the config validates cleanly.",
      ],
    };
  }

  if (hasDiagnosticCode(diagnostics, "grocy_unreachable")) {
    return {
      classification: "investigate_live_api",
      severity: "error",
      summary: "Local config is present, but the Grocy live read probes did not complete successfully.",
      nextActions: [
        "Confirm the configured baseUrl points at the intended Grocy instance and is reachable from this machine.",
        "Confirm the configured API key still has read access for the current health probes.",
        "Rerun npm run grocy:health:diagnostics after the connectivity or permission issue is resolved.",
      ],
    };
  }

  return {
    classification: "healthy",
    severity: "info",
    summary: "Grocy health checks passed, so no immediate operator follow-up is required.",
    nextActions: [],
  };
}
