import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createGrocyBackupSnapshot,
  GrocyBackupRestoreError,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import { runGrocyHealthCheck } from "./grocy-live.js";
import {
  GrocySecretRotationSmokeReportSchema,
  type GrocySecretRotationSmokeReport,
  type GrocySecretRotationSmokeReportCheck,
} from "./secret-rotation-smoke-schema.js";
import { createSyntheticGrocyFetch } from "./synthetic-grocy-fixtures.js";

export const GROCY_SECRET_ROTATION_SMOKE_REPORT_PATH = path.join("data", "grocy-secret-rotation-smoke-report.json");

const SYNTHETIC_BASE_URL = "https://grocy.example.test";
const OLD_API_KEY = "synthetic-api-key-v1";
const NEW_API_KEY = "synthetic-api-key-v2";
const OLD_BACKUP_PASSPHRASE = "synthetic-backup-passphrase-v1";
const NEW_BACKUP_PASSPHRASE = "synthetic-backup-passphrase-v2";
const BACKUP_PASSPHRASE_ENV = "GROCY_SYNTHETIC_BACKUP_PASSPHRASE";

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function writeGrocyConfig(baseDir: string, apiKey: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    `${JSON.stringify({ baseUrl: SYNTHETIC_BASE_URL, apiKey, timeoutMs: 1000 }, null, 2)}\n`,
    "utf8",
  );
}

function writeBackupFixture(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "source", "data"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "source", "config.php"), "<?php return ['mode' => 'synthetic'];\n", "utf8");
  fs.writeFileSync(
    path.join(baseDir, "source", "data", "grocy.json"),
    `${JSON.stringify({
      products: [{ id: "example-coffee", name: "Example Coffee" }],
      metadata: { fixture: "synthetic-secret-rotation" },
    }, null, 2)}\n`,
    "utf8",
  );
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
    `${JSON.stringify({
      sourcePath: "source",
      backupDir: path.join("backups", "grocy"),
      passphraseEnv: BACKUP_PASSPHRASE_ENV,
      locationLabel: "synthetic-secret-rotation",
    }, null, 2)}\n`,
    "utf8",
  );
}

function createCredentialRotationFetch(activeApiKey: string): typeof fetch {
  const baseFetch = createSyntheticGrocyFetch();
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (headers.get("GROCY-API-KEY") !== activeApiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "Content-Type": "application/json" },
      });
    }
    return await baseFetch(input, init);
  }) as typeof fetch;
}

function passCheck(id: GrocySecretRotationSmokeReportCheck["id"], message: string): GrocySecretRotationSmokeReportCheck {
  return { id, status: "pass", message };
}

async function runCredentialRotationChecks(workspace: string): Promise<GrocySecretRotationSmokeReportCheck[]> {
  writeGrocyConfig(workspace, OLD_API_KEY);

  const baseline = await runGrocyHealthCheck(workspace, createCredentialRotationFetch(OLD_API_KEY));
  if (!baseline.status.reachable) {
    throw new Error("Synthetic credential baseline did not authenticate.");
  }

  const staleCredential = await runGrocyHealthCheck(workspace, createCredentialRotationFetch(NEW_API_KEY));
  if (staleCredential.status.reachable) {
    throw new Error("Synthetic stale credential unexpectedly remained valid after rotation.");
  }

  writeGrocyConfig(workspace, NEW_API_KEY);
  const rotated = await runGrocyHealthCheck(workspace, createCredentialRotationFetch(NEW_API_KEY));
  if (!rotated.status.reachable) {
    throw new Error("Synthetic rotated credential did not restore Grocy health.");
  }

  return [
    passCheck("credential_baseline", "Synthetic Grocy credential authenticated before rotation."),
    passCheck("credential_stale_rejected", "Synthetic Grocy credential rotation rejected the stale API key."),
    passCheck("credential_rotated", "Synthetic Grocy credential rotation accepted the updated API key."),
  ];
}

function runBackupKeyRotationChecks(workspace: string): GrocySecretRotationSmokeReportCheck[] {
  writeBackupFixture(workspace);

  process.env[BACKUP_PASSPHRASE_ENV] = OLD_BACKUP_PASSPHRASE;
  const baselineRecord = createGrocyBackupSnapshot(workspace, {
    createdAt: "2026-04-24T10:00:00.000Z",
  });
  const baselineVerification = verifyGrocyBackupSnapshot(workspace, {
    archivePath: baselineRecord.archivePath,
  });
  if (!baselineVerification.checksumVerified) {
    throw new Error("Synthetic backup key baseline did not verify.");
  }

  process.env[BACKUP_PASSPHRASE_ENV] = NEW_BACKUP_PASSPHRASE;
  let staleRejected = false;
  try {
    verifyGrocyBackupSnapshot(workspace, { archivePath: baselineRecord.archivePath });
  } catch (error) {
    if (error instanceof GrocyBackupRestoreError && error.category === "archive_decryption_failed") {
      staleRejected = true;
    } else {
      throw error;
    }
  }
  if (!staleRejected) {
    throw new Error("Synthetic backup key rotation did not reject the stale archive passphrase.");
  }

  const rotatedRecord = createGrocyBackupSnapshot(workspace, {
    createdAt: "2026-04-24T10:05:00.000Z",
  });
  const rotatedVerification = verifyGrocyBackupSnapshot(workspace, {
    archivePath: rotatedRecord.archivePath,
    restoreDir: path.join("restore", "rotated-backup-check"),
    confirmRestoreWrite: true,
  });
  if (!rotatedVerification.checksumVerified) {
    throw new Error("Synthetic rotated backup key did not verify.");
  }

  return [
    passCheck("backup_key_baseline", "Synthetic backup archive verified before backup-key rotation."),
    passCheck("backup_key_stale_rejected", "Synthetic backup-key rotation rejected the stale archive passphrase."),
    passCheck("backup_key_rotated", "Synthetic backup-key rotation verified a fresh archive under the rotated passphrase."),
  ];
}

export function recordGrocySecretRotationSmokeReport(
  report: GrocySecretRotationSmokeReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_SECRET_ROTATION_SMOKE_REPORT_PATH),
    GrocySecretRotationSmokeReportSchema.parse(report),
    options.overwrite ?? true,
  );
}

export async function runGrocySecretRotationSmokeTest(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string; outputPath?: string } = {},
): Promise<GrocySecretRotationSmokeReport> {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-secret-rotation-"));
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const previousBackupPassphrase = process.env[BACKUP_PASSPHRASE_ENV];

  try {
    const checks = [
      ...(await runCredentialRotationChecks(workspace)),
      ...runBackupKeyRotationChecks(workspace),
    ];

    const report = GrocySecretRotationSmokeReportSchema.parse({
      kind: "grocy_secret_rotation_smoke_report",
      version: 1,
      generatedAt,
      scope: "synthetic_fixture_only",
      summary: {
        result: "pass",
        checkCount: checks.length,
        failureCount: 0,
      },
      checks,
      reviewNotes: [
        "This smoke test uses synthetic Grocy credentials, synthetic backup passphrases, and generated fixture files only.",
        "The report intentionally omits API keys, passphrase values, live URLs, and archive contents.",
      ],
    });

    if (options.outputPath) {
      recordGrocySecretRotationSmokeReport(report, { baseDir, outputPath: options.outputPath });
    }

    return report;
  } finally {
    if (previousBackupPassphrase === undefined) {
      delete process.env[BACKUP_PASSPHRASE_ENV];
    } else {
      process.env[BACKUP_PASSPHRASE_ENV] = previousBackupPassphrase;
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
