import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GROCY_BACKUP_CONFIG_PATH,
  GROCY_BACKUP_MANIFEST_PATH,
  createGrocyBackupSnapshot,
  GrocyBackupRestoreError,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import {
  type GrocyBackupRestoreFailureCategory,
} from "./schemas.js";
import {
  GrocyBackupRestoreFailureDrillReportSchema,
  type GrocyBackupRestoreFailureDrillReport,
  type GrocyBackupRestoreFailureDrillScenario,
} from "./backup-restore-failure-drill-schema.js";

export const GROCY_BACKUP_RESTORE_FAILURE_DRILL_REPORT_PATH = path.join("data", "grocy-backup-restore-failure-drill-report.json");
export const DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR = path.join("restore", "grocy-restore-failure-drill");

interface GrocyBackupLocalConfig {
  sourcePath: string;
  passphraseEnv: string;
}

interface BackupBundleFile {
  path: string;
  mode: number;
  mtimeMs: number;
  size: number;
  sha256: string;
  contentBase64: string;
}

interface BackupBundle {
  kind: "grocy_backup_bundle";
  version: 1;
  createdAt: string;
  sourcePath: string;
  files: BackupBundleFile[];
}

interface BackupArchiveEnvelope {
  kind: "grocy_backup_archive";
  version: 1;
  algorithm: "aes-256-gcm";
  kdf: "scrypt";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

function normalizeDisplayPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toPublicSafePath(baseDir: string, targetPath: string): string {
  const relativePath = path.relative(baseDir, path.resolve(baseDir, targetPath));
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? "[external-path-redacted]"
    : normalizeDisplayPath(relativePath);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function parseBackupConfig(raw: unknown): GrocyBackupLocalConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Grocy backup config must be an object.");
  }
  const record = raw as Record<string, unknown>;
  const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath : "";
  const passphraseEnv = typeof record.passphraseEnv === "string" ? record.passphraseEnv : "GROCY_BACKUP_PASSPHRASE";
  if (!sourcePath.trim()) {
    throw new Error("Grocy backup config requires sourcePath.");
  }
  return { sourcePath, passphraseEnv };
}

function loadBackupConfig(baseDir: string, configPath = GROCY_BACKUP_CONFIG_PATH): GrocyBackupLocalConfig {
  return parseBackupConfig(readJsonFile(path.resolve(baseDir, configPath)));
}

function requirePassphrase(config: GrocyBackupLocalConfig): string {
  const passphrase = process.env[config.passphraseEnv];
  if (!passphrase) {
    throw new Error(`Grocy backup passphrase env var ${config.passphraseEnv} is not set.`);
  }
  return passphrase;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

function sha256(buffer: Buffer | string): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readArchiveEnvelope(archivePath: string): BackupArchiveEnvelope {
  return JSON.parse(fs.readFileSync(archivePath, "utf8")) as BackupArchiveEnvelope;
}

function decryptBundle(archivePath: string, passphrase: string): BackupBundle {
  const payload = readArchiveEnvelope(archivePath);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, Buffer.from(payload.salt, "base64")),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as BackupBundle;
}

function encryptBundle(bundle: BackupBundle, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(bundle), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    kind: "grocy_backup_archive",
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  } satisfies BackupArchiveEnvelope), "utf8");
}

function rewriteArchiveBundle(
  archivePath: string,
  passphrase: string,
  transform: (bundle: BackupBundle) => BackupBundle,
): void {
  const bundle = decryptBundle(archivePath, passphrase);
  fs.writeFileSync(archivePath, encryptBundle(transform(bundle), passphrase));
}

function updateManifestChecksum(
  baseDir: string,
  recordId: string,
  archivePath: string,
  manifestPath = GROCY_BACKUP_MANIFEST_PATH,
): void {
  const absoluteManifestPath = path.resolve(baseDir, manifestPath);
  const manifest = readJsonFile(absoluteManifestPath) as { records: Array<{ id: string; checksumSha256: string }> };
  const archive = fs.readFileSync(archivePath);
  const nextManifest = {
    ...manifest,
    records: manifest.records.map((record) => (
      record.id === recordId ? { ...record, checksumSha256: sha256(archive) } : record
    )),
  };
  fs.writeFileSync(absoluteManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
}

function offsetIsoTimestamp(timestamp: string, seconds: number): string {
  const value = new Date(timestamp);
  value.setUTCSeconds(value.getUTCSeconds() + seconds);
  return value.toISOString();
}

function buildScenario(
  id: GrocyBackupRestoreFailureDrillScenario["id"],
  expectedFailureCategory: GrocyBackupRestoreFailureCategory,
  command: string,
  artifactPath: string,
  evidence: string[],
): GrocyBackupRestoreFailureDrillScenario {
  return {
    id,
    status: "pass",
    expectedFailureCategory,
    observedFailureCategory: expectedFailureCategory,
    command,
    artifactPath,
    evidence,
  };
}

function runExpectedFailure(
  action: () => void,
  expectedFailureCategory: GrocyBackupRestoreFailureCategory,
): GrocyBackupRestoreError {
  try {
    action();
  } catch (error) {
    if (error instanceof GrocyBackupRestoreError && error.category === expectedFailureCategory) {
      return error;
    }
    throw error;
  }
  throw new Error(`Expected restore failure category ${expectedFailureCategory}.`);
}

function summarizeScenarios(scenarios: GrocyBackupRestoreFailureDrillScenario[]): GrocyBackupRestoreFailureDrillReport["summary"] {
  const passedCount = scenarios.filter((scenario) => scenario.status === "pass").length;
  return {
    result: passedCount === scenarios.length ? "pass" : "fail",
    scenarioCount: scenarios.length,
    passedCount,
  };
}

export function createGrocyBackupRestoreFailureDrillReport(
  baseDir: string = process.cwd(),
  options: {
    generatedAt?: string;
    configPath?: string;
    manifestPath?: string;
    restoreDir?: string;
  } = {},
): GrocyBackupRestoreFailureDrillReport {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const config = loadBackupConfig(baseDir, options.configPath);
  const baselinePassphrase = requirePassphrase(config);
  const sourcePath = path.resolve(baseDir, config.sourcePath);
  const restoreDir = options.restoreDir ?? DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR;
  const restoreDirPath = path.resolve(baseDir, restoreDir);
  const manifestPath = path.resolve(baseDir, options.manifestPath ?? GROCY_BACKUP_MANIFEST_PATH);
  const originalPassphrase = process.env[config.passphraseEnv];

  const corruptionSnapshot = createGrocyBackupSnapshot(baseDir, {
    createdAt: offsetIsoTimestamp(generatedAt, 0),
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  rewriteArchiveBundle(corruptionSnapshot.archivePath, baselinePassphrase, (bundle) => ({ ...bundle }));
  const corruptionError = runExpectedFailure(
    () => {
      verifyGrocyBackupSnapshot(baseDir, {
        archivePath: corruptionSnapshot.archivePath,
        configPath: options.configPath,
        manifestPath: options.manifestPath,
      });
    },
    "manifest_checksum_mismatch",
  );

  const wrongPassphraseSnapshot = createGrocyBackupSnapshot(baseDir, {
    createdAt: offsetIsoTimestamp(generatedAt, 1),
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  process.env[config.passphraseEnv] = `${baselinePassphrase}-wrong-passphrase-drill`;
  let wrongPassphraseError: GrocyBackupRestoreError;
  try {
    wrongPassphraseError = runExpectedFailure(
      () => {
        verifyGrocyBackupSnapshot(baseDir, {
          archivePath: wrongPassphraseSnapshot.archivePath,
          configPath: options.configPath,
          manifestPath: options.manifestPath,
        });
      },
      "archive_decryption_failed",
    );
  } finally {
    if (originalPassphrase === undefined) {
      delete process.env[config.passphraseEnv];
    } else {
      process.env[config.passphraseEnv] = originalPassphrase;
    }
  }

  const pathEscapeSnapshot = createGrocyBackupSnapshot(baseDir, {
    createdAt: offsetIsoTimestamp(generatedAt, 2),
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  rewriteArchiveBundle(pathEscapeSnapshot.archivePath, baselinePassphrase, (bundle) => ({
    ...bundle,
    files: bundle.files.map((file, index) => (
      index === 0 ? { ...file, path: `../escape/${path.basename(file.path)}` } : file
    )),
  }));
  updateManifestChecksum(baseDir, pathEscapeSnapshot.id, pathEscapeSnapshot.archivePath, options.manifestPath);
  const pathEscapeError = runExpectedFailure(
    () => {
      verifyGrocyBackupSnapshot(baseDir, {
        archivePath: pathEscapeSnapshot.archivePath,
        restoreDir,
        confirmRestoreWrite: true,
        configPath: options.configPath,
        manifestPath: options.manifestPath,
      });
    },
    "restore_path_escape",
  );

  const scenarios = [
    buildScenario(
      "corruption_detected",
      "manifest_checksum_mismatch",
      "npm run grocy:backup:restore-failure-drill",
      toPublicSafePath(baseDir, manifestPath),
      [
        "A synthetic archive was re-encrypted after snapshot creation so the manifest checksum no longer matched the latest archive bytes.",
        `Verification rejected the injected corruption with ${corruptionError.category}.`,
        "The failure stayed inside the encrypted archive and manifest boundary without exposing bundle contents.",
      ],
    ),
    buildScenario(
      "wrong_passphrase_rejected",
      "archive_decryption_failed",
      "npm run grocy:backup:restore-failure-drill",
      toPublicSafePath(baseDir, manifestPath),
      [
        "A synthetic archive was verified with an intentionally rotated passphrase value.",
        `Verification rejected the mismatched passphrase with ${wrongPassphraseError.category}.`,
        "The drill proves the toolkit records passphrase mismatch as a public-safe decryption failure class.",
      ],
    ),
    buildScenario(
      "path_escape_blocked",
      "restore_path_escape",
      "npm run grocy:backup:restore-failure-drill",
      toPublicSafePath(baseDir, restoreDirPath),
      [
        "A synthetic archive entry path was rewritten to escape the requested restore directory before verification.",
        `Verification rejected the restore target with ${pathEscapeError.category}.`,
        "No synthetic bundle file was allowed to write outside the requested restore directory.",
      ],
    ),
  ] satisfies GrocyBackupRestoreFailureDrillScenario[];

  return GrocyBackupRestoreFailureDrillReportSchema.parse({
    kind: "grocy_backup_restore_failure_drill_report",
    version: 1,
    generatedAt,
    scope: "synthetic_fixture_only",
    sourcePath: toPublicSafePath(baseDir, sourcePath),
    restoreDir: toPublicSafePath(baseDir, restoreDirPath),
    summary: summarizeScenarios(scenarios),
    scenarios,
    artifacts: {
      manifestPath: toPublicSafePath(baseDir, manifestPath),
    },
    reviewNotes: [
      "This failure drill is fixture-only and uses synthetic archive mutations to exercise corruption, wrong-passphrase, and path-escape restore defenses.",
      "Treat the scenario statuses as the machine-checkable signoff surface for failure-class coverage.",
      "Keep the backup config pointed at synthetic fixtures when running this drill from the public toolkit.",
    ],
  });
}

export function recordGrocyBackupRestoreFailureDrillReport(
  report: GrocyBackupRestoreFailureDrillReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_RESTORE_FAILURE_DRILL_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
