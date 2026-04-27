import {
  createGrocyBackupRetentionSimulationReport,
  recordGrocyBackupRetentionSimulationReport,
} from "./backup-retention-simulation.js";
import {
  recordGrocyBackupIntegrityReceiptVerification,
  createGrocyBackupIntegrityReceipt,
  recordGrocyBackupIntegrityReceipt,
  verifyGrocyBackupIntegrityReceipt,
} from "./backup-integrity-receipt.js";
import {
  createGrocyBackupRestorePlanDryRunReport,
  createGrocyBackupSnapshot,
  recordGrocyBackupRestorePlanDryRunReport,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import {
  createGrocyBackupVerificationReport,
  recordGrocyBackupVerificationReport,
} from "./backup-verification-report.js";
import {
  createGrocyBackupRestoreDrillReport,
  DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR,
  recordGrocyBackupRestoreDrillReport,
} from "./backup-restore-drill.js";
import {
  createGrocyBackupRestoreFailureDrillReport,
  DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR,
  recordGrocyBackupRestoreFailureDrillReport,
} from "./backup-restore-failure-drill.js";

interface GrocyBackupCliContext {
  argv: string[];
  baseDir: string;
  parseFlag: (flag: string) => string | undefined;
  printJson: (value: unknown) => void;
}

function hasForceOutput(argv: string[], outputPath: string | undefined): boolean {
  return argv.includes("--force") || !outputPath;
}

function handleGrocyBackupRetentionSimulationCommand(context: GrocyBackupCliContext): void {
  const { argv, baseDir, parseFlag, printJson } = context;
  const historyPath = parseFlag("--history");
  if (!historyPath) {
    throw new Error("Usage: grocy:backup:retention-simulate -- --history <path>");
  }
  const report = createGrocyBackupRetentionSimulationReport(baseDir, {
    historyPath,
  });
  const outputPath = recordGrocyBackupRetentionSimulationReport(report, {
    outputPath: parseFlag("--output"),
    overwrite: hasForceOutput(argv, parseFlag("--output")),
  });
  printJson({ outputPath, summary: report.summary });
}

function handleGrocyBackupSnapshotCommand(command: string | undefined, context: GrocyBackupCliContext): boolean {
  const { baseDir, printJson } = context;
  if (command !== "grocy:backup:snapshot") {
    return false;
  }
  printJson(createGrocyBackupSnapshot(baseDir));
  return true;
}

function handleGrocyBackupVerifyCommand(command: string | undefined, context: GrocyBackupCliContext): boolean {
  const { argv, baseDir, parseFlag, printJson } = context;
  if (command !== "grocy:backup:verify") {
    return false;
  }
  const outputPath = parseFlag("--output");
  if (outputPath) {
    const report = createGrocyBackupVerificationReport(baseDir, {
      archivePath: parseFlag("--archive"),
      restoreDir: parseFlag("--restore-dir"),
      confirmRestoreWrite: argv.includes("--confirm-restore-write"),
    });
    const recordedPath = recordGrocyBackupVerificationReport(report, {
      outputPath,
      overwrite: argv.includes("--force"),
    });
    printJson({ outputPath: recordedPath, verification: report.verification });
    if (report.verification.status !== "pass") {
      process.exitCode = 1;
    }
    return true;
  }

  printJson(verifyGrocyBackupSnapshot(baseDir, {
    archivePath: parseFlag("--archive"),
    restoreDir: parseFlag("--restore-dir"),
    confirmRestoreWrite: argv.includes("--confirm-restore-write"),
  }));
  return true;
}

function handleGrocyBackupReceiptCommands(command: string | undefined, context: GrocyBackupCliContext): boolean {
  const { argv, baseDir, parseFlag, printJson } = context;
  if (command === "grocy:backup:receipt") {
    const receipt = createGrocyBackupIntegrityReceipt(baseDir, {
      archivePath: parseFlag("--archive"),
      configPath: parseFlag("--config"),
      manifestPath: parseFlag("--manifest"),
      restorePlanReportPath: parseFlag("--restore-plan-report"),
      restoreDrillReportPath: parseFlag("--restore-drill-report"),
    });
    const outputPath = recordGrocyBackupIntegrityReceipt(receipt, {
      outputPath: parseFlag("--output"),
      overwrite: hasForceOutput(argv, parseFlag("--output")),
    });
    printJson({ outputPath, summary: receipt.summary });
    if (receipt.summary.status !== "pass") {
      process.exitCode = 1;
    }
    return true;
  }

  if (command === "grocy:backup:receipt:verify") {
    const verification = verifyGrocyBackupIntegrityReceipt(baseDir, {
      receiptPath: parseFlag("--receipt"),
      configPath: parseFlag("--config"),
      manifestPath: parseFlag("--manifest"),
      restorePlanReportPath: parseFlag("--restore-plan-report"),
      restoreDrillReportPath: parseFlag("--restore-drill-report"),
    });
    const outputPath = parseFlag("--output");
    if (outputPath) {
      const recordedPath = recordGrocyBackupIntegrityReceiptVerification(verification, {
        outputPath,
        overwrite: argv.includes("--force"),
      });
      printJson({ outputPath: recordedPath, summary: verification.summary });
    } else {
      printJson(verification);
    }
    if (verification.summary.status !== "pass") {
      process.exitCode = 1;
    }
    return true;
  }
  return false;
}

function handleGrocyBackupRestoreCommands(command: string | undefined, context: GrocyBackupCliContext): boolean {
  const { argv, baseDir, parseFlag, printJson } = context;
  if (command === "grocy:backup:restore-plan") {
    const restoreDir = parseFlag("--restore-dir");
    if (!restoreDir) {
      throw new Error("Usage: grocy:backup:restore-plan -- --restore-dir <path>");
    }
    const report = createGrocyBackupRestorePlanDryRunReport(baseDir, {
      archivePath: parseFlag("--archive"),
      restoreDir,
    });
    const outputPath = recordGrocyBackupRestorePlanDryRunReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: hasForceOutput(argv, parseFlag("--output")),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "ready") {
      process.exitCode = 1;
    }
    return true;
  }

  if (command === "grocy:backup:restore-drill") {
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: parseFlag("--restore-dir") ?? DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR,
    });
    const outputPath = recordGrocyBackupRestoreDrillReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: hasForceOutput(argv, parseFlag("--output")),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "pass") {
      process.exitCode = 1;
    }
    return true;
  }

  if (command === "grocy:backup:restore-failure-drill") {
    const report = createGrocyBackupRestoreFailureDrillReport(baseDir, {
      restoreDir: parseFlag("--restore-dir") ?? DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR,
    });
    const outputPath = recordGrocyBackupRestoreFailureDrillReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: hasForceOutput(argv, parseFlag("--output")),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "pass") {
      process.exitCode = 1;
    }
    return true;
  }
  return false;
}

function handleGrocyBackupSimulationCommands(command: string | undefined, context: GrocyBackupCliContext): boolean {
  if (command === "grocy:backup:retention-simulate") {
    handleGrocyBackupRetentionSimulationCommand(context);
    return true;
  }
  return false;
}

export function handleGrocyBackupCommand(command: string | undefined, context: GrocyBackupCliContext): boolean {
  if (handleGrocyBackupSnapshotCommand(command, context)) {
    return true;
  }
  if (handleGrocyBackupVerifyCommand(command, context)) {
    return true;
  }
  if (handleGrocyBackupReceiptCommands(command, context)) {
    return true;
  }
  if (handleGrocyBackupRestoreCommands(command, context)) {
    return true;
  }
  if (handleGrocyBackupSimulationCommands(command, context)) {
    return true;
  }

  return false;
}
