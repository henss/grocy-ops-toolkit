import {
  applyGrocyConfigSyncPlan,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  loadGrocyConfigExport,
  loadGrocyConfigManifest,
  recordGrocyConfigExport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import { createGrocyBackupSnapshot, verifyGrocyBackupSnapshot } from "./backups.js";
import { getGrocyConfigStatus, runGrocyHealthCheck } from "./grocy-live.js";

function parseFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "grocy:config:status") {
    printJson(getGrocyConfigStatus(process.cwd()));
    return;
  }
  if (command === "grocy:health") {
    printJson(await runGrocyHealthCheck(process.cwd()));
    return;
  }
  if (command === "grocy:export-config") {
    const exportData = await exportGrocyConfig(process.cwd());
    const outputPath = recordGrocyConfigExport(exportData, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, exportedAt: exportData.exportedAt, counts: exportData.counts, items: exportData.items.length });
    return;
  }
  if (command === "grocy:diff-config") {
    const manifestPath = parseFlag("--manifest");
    const exportPath = parseFlag("--export");
    const liveExport = exportPath ? loadGrocyConfigExport(exportPath) : await exportGrocyConfig(process.cwd());
    const plan = createGrocyConfigSyncPlan({
      manifest: loadGrocyConfigManifest(process.cwd(), manifestPath),
      liveExport,
      manifestPath: manifestPath ?? "registry/grocy/desired-state.json",
      exportPath,
    });
    const outputPath = recordGrocyConfigSyncPlan(plan, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: plan.summary });
    return;
  }
  if (command === "grocy:apply-config") {
    const planPath = parseFlag("--plan");
    if (!planPath) {
      throw new Error("Usage: grocy:apply-config -- --plan <path> --confirm-reviewed-write");
    }
    printJson(await applyGrocyConfigSyncPlan(planPath, process.cwd(), {
      confirmReviewedWrite: process.argv.includes("--confirm-reviewed-write"),
    }));
    return;
  }
  if (command === "grocy:backup:snapshot") {
    printJson(createGrocyBackupSnapshot(process.cwd()));
    return;
  }
  if (command === "grocy:backup:verify") {
    printJson(verifyGrocyBackupSnapshot(process.cwd(), {
      archivePath: parseFlag("--archive"),
      restoreDir: parseFlag("--restore-dir"),
      confirmRestoreWrite: process.argv.includes("--confirm-restore-write"),
    }));
    return;
  }
  throw new Error("Unsupported command.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
