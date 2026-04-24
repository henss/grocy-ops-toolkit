import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GrocyBackupManifestSchema,
  GrocyBackupRecordSchema,
  GrocyBackupRestorePlanDryRunReportSchema,
  type GrocyBackupManifest,
  type GrocyBackupRecord,
  type GrocyBackupRestoreFailureCategory,
  type GrocyBackupRestorePlanDryRunReport,
  type GrocyBackupRestorePlanDryRunReportItem,
} from "./schemas.js";

export const GROCY_BACKUP_CONFIG_PATH = path.join("config", "grocy-backup.local.json");
export const GROCY_BACKUP_MANIFEST_PATH = path.join("data", "grocy-backup-manifest.json");
export const GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH = path.join("data", "grocy-backup-restore-plan-dry-run-report.json");

interface GrocyBackupLocalConfig {
  sourcePath: string;
  backupDir: string;
  passphraseEnv?: string;
  locationLabel?: string;
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

export class GrocyBackupRestoreError extends Error {
  readonly category: GrocyBackupRestoreFailureCategory;

  constructor(category: GrocyBackupRestoreFailureCategory, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GrocyBackupRestoreError";
    this.category = category;
  }
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function sha256(buffer: Buffer | string): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function parseBackupConfig(raw: unknown): GrocyBackupLocalConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Grocy backup config must be an object.");
  }
  const record = raw as Record<string, unknown>;
  const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath : "";
  const backupDir = typeof record.backupDir === "string" ? record.backupDir : "";
  const passphraseEnv = typeof record.passphraseEnv === "string" ? record.passphraseEnv : "GROCY_BACKUP_PASSPHRASE";
  const locationLabel = typeof record.locationLabel === "string" ? record.locationLabel : "local-encrypted";
  if (!sourcePath.trim() || !backupDir.trim()) {
    throw new Error("Grocy backup config requires sourcePath and backupDir.");
  }
  return { sourcePath, backupDir, passphraseEnv, locationLabel };
}

function loadBackupConfig(baseDir: string, configPath = GROCY_BACKUP_CONFIG_PATH): GrocyBackupLocalConfig {
  const absoluteConfigPath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Grocy backup config is missing at ${absoluteConfigPath}.`);
  }
  const parsed = parseBackupConfig(readJsonFile(absoluteConfigPath));
  return {
    ...parsed,
    sourcePath: path.resolve(baseDir, parsed.sourcePath),
    backupDir: path.resolve(baseDir, parsed.backupDir),
  };
}

function collectFiles(sourcePath: string): BackupBundleFile[] {
  const stat = fs.statSync(sourcePath);
  const root = stat.isDirectory() ? sourcePath : path.dirname(sourcePath);
  const files: string[] = [];
  function walk(currentPath: string): void {
    const currentStat = fs.statSync(currentPath);
    if (currentStat.isDirectory()) {
      for (const child of fs.readdirSync(currentPath).sort()) {
        walk(path.join(currentPath, child));
      }
      return;
    }
    if (currentStat.isFile()) {
      files.push(currentPath);
    }
  }
  walk(sourcePath);
  return files.map((filePath) => {
    const fileStat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    return {
      path: path.relative(root, filePath).replace(/\\/g, "/"),
      mode: fileStat.mode,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
      sha256: sha256(content),
      contentBase64: content.toString("base64"),
    };
  });
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
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
  }), "utf8");
}

function decryptBundle(archive: Buffer, passphrase: string): BackupBundle {
  let payload: Record<string, string | number>;
  try {
    payload = JSON.parse(archive.toString("utf8")) as Record<string, string | number>;
  } catch (error) {
    throw new GrocyBackupRestoreError("archive_unreadable", "Grocy backup archive could not be read as JSON.", { cause: error });
  }
  if (payload.kind !== "grocy_backup_archive" || payload.version !== 1 || payload.algorithm !== "aes-256-gcm") {
    throw new GrocyBackupRestoreError("archive_format_unsupported", "Unsupported Grocy backup archive format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, Buffer.from(String(payload.salt), "base64")),
    Buffer.from(String(payload.iv), "base64"),
  );
  decipher.setAuthTag(Buffer.from(String(payload.tag), "base64"));
  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(String(payload.ciphertext), "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as BackupBundle;
  } catch (error) {
    throw new GrocyBackupRestoreError("archive_decryption_failed", "Grocy backup archive could not be decrypted.", { cause: error });
  }
}

function loadBackupManifest(baseDir: string, manifestPath = GROCY_BACKUP_MANIFEST_PATH): GrocyBackupManifest {
  const absoluteManifestPath = path.resolve(baseDir, manifestPath);
  if (!fs.existsSync(absoluteManifestPath)) {
    return { kind: "grocy_backup_manifest", version: 1, updatedAt: new Date().toISOString(), records: [] };
  }
  return GrocyBackupManifestSchema.parse(readJsonFile(absoluteManifestPath));
}

function loadBackupRecord(
  manifest: GrocyBackupManifest,
  archivePath?: string,
): GrocyBackupRecord | undefined {
  return archivePath
    ? manifest.records.find((record) => path.resolve(record.archivePath) === path.resolve(archivePath))
    : manifest.records[0];
}

function recordBackupManifest(baseDir: string, record: GrocyBackupRecord, manifestPath = GROCY_BACKUP_MANIFEST_PATH): string {
  const absoluteManifestPath = path.resolve(baseDir, manifestPath);
  const current = loadBackupManifest(baseDir, manifestPath);
  const updated = GrocyBackupManifestSchema.parse({
    kind: "grocy_backup_manifest",
    version: 1,
    updatedAt: new Date().toISOString(),
    records: [record, ...current.records.filter((item) => item.id !== record.id)],
  });
  writeJsonFile(absoluteManifestPath, updated);
  return absoluteManifestPath;
}

function updateBackupManifestRecord(
  baseDir: string,
  recordId: string,
  updates: Partial<GrocyBackupRecord>,
  manifestPath = GROCY_BACKUP_MANIFEST_PATH,
): void {
  const absoluteManifestPath = path.resolve(baseDir, manifestPath);
  const current = loadBackupManifest(baseDir, manifestPath);
  const updated = GrocyBackupManifestSchema.parse({
    ...current,
    updatedAt: new Date().toISOString(),
    records: current.records.map((record) => (
      record.id === recordId ? GrocyBackupRecordSchema.parse({ ...record, ...updates }) : record
    )),
  });
  writeJsonFile(absoluteManifestPath, updated);
}

function markRestoreFailure(
  baseDir: string,
  recordId: string,
  category: GrocyBackupRestoreFailureCategory,
  manifestPath = GROCY_BACKUP_MANIFEST_PATH,
): void {
  updateBackupManifestRecord(baseDir, recordId, {
    restoreTestStatus: "failed",
    restoreTestedAt: new Date().toISOString(),
    restoreFailureCategory: category,
  }, manifestPath);
}

function requirePassphrase(config: GrocyBackupLocalConfig): string {
  const variableName = config.passphraseEnv ?? "GROCY_BACKUP_PASSPHRASE";
  const passphrase = process.env[variableName];
  if (!passphrase) {
    throw new Error(`Grocy backup passphrase env var ${variableName} is not set.`);
  }
  return passphrase;
}

export function createGrocyBackupSnapshot(
  baseDir: string = process.cwd(),
  options: { createdAt?: string; configPath?: string; manifestPath?: string } = {},
): GrocyBackupRecord & { manifestPath: string } {
  const config = loadBackupConfig(baseDir, options.configPath);
  const passphrase = requirePassphrase(config);
  if (!fs.existsSync(config.sourcePath)) {
    throw new Error(`Grocy backup source path does not exist: ${config.sourcePath}`);
  }
  fs.mkdirSync(config.backupDir, { recursive: true });
  const createdAt = options.createdAt ?? new Date().toISOString();
  const files = collectFiles(config.sourcePath);
  const encrypted = encryptBundle({ kind: "grocy_backup_bundle", version: 1, createdAt, sourcePath: config.sourcePath, files }, passphrase);
  const id = `grocy-backup-${createdAt.slice(0, 19).replace(/[^0-9]/g, "")}`;
  const archivePath = path.join(config.backupDir, `${slugify(id)}.grocy-backup.enc`);
  fs.writeFileSync(archivePath, encrypted);
  const record = GrocyBackupRecordSchema.parse({
    id,
    createdAt,
    sourcePath: config.sourcePath,
    archivePath,
    locationLabel: config.locationLabel ?? "local-encrypted",
    checksumSha256: sha256(encrypted),
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    restoreTestStatus: "not_tested",
    notes: ["Encrypted full Grocy data/config snapshot. Archive contents are intentionally stored outside Git."],
  });
  return { ...record, manifestPath: recordBackupManifest(baseDir, record, options.manifestPath) };
}

export function verifyGrocyBackupSnapshot(
  baseDir: string = process.cwd(),
  options: { archivePath?: string; restoreDir?: string; confirmRestoreWrite?: boolean; configPath?: string; manifestPath?: string } = {},
): { archivePath: string; fileCount: number; totalBytes: number; checksumVerified: boolean; restoredTo?: string } {
  const config = loadBackupConfig(baseDir, options.configPath);
  const passphrase = requirePassphrase(config);
  const manifest = loadBackupManifest(baseDir, options.manifestPath);
  const latest = loadBackupRecord(manifest, options.archivePath);
  if (!latest) {
    throw new Error("No Grocy backup record found to verify.");
  }
  const archivePath = path.resolve(latest.archivePath);
  try {
    let archive: Buffer;
    try {
      archive = fs.readFileSync(archivePath);
    } catch (error) {
      throw new GrocyBackupRestoreError("archive_unreadable", `Grocy backup archive could not be read at ${archivePath}.`, { cause: error });
    }
    const bundle = decryptBundle(archive, passphrase);
    const checksumVerified = sha256(archive) === latest.checksumSha256;
    if (!checksumVerified) {
      throw new GrocyBackupRestoreError("manifest_checksum_mismatch", `Grocy backup checksum verification failed for ${archivePath}.`);
    }
    for (const file of bundle.files) {
      const content = Buffer.from(file.contentBase64, "base64");
      if (sha256(content) !== file.sha256) {
        throw new GrocyBackupRestoreError("bundle_file_checksum_mismatch", `Grocy backup verification failed for ${file.path}.`);
      }
    }
    let restoredTo: string | undefined;
    if (options.restoreDir) {
      if (!options.confirmRestoreWrite) {
        throw new GrocyBackupRestoreError("restore_write_unconfirmed", "Refusing restore verification write without --confirm-restore-write.");
      }
      const restoreDir = path.resolve(baseDir, options.restoreDir);
      try {
        fs.mkdirSync(restoreDir, { recursive: true });
        for (const file of bundle.files) {
          const target = path.resolve(restoreDir, file.path);
          if (!isPathInside(restoreDir, target)) {
            throw new GrocyBackupRestoreError("restore_path_escape", `Refusing to restore path outside target directory: ${file.path}`);
          }
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, Buffer.from(file.contentBase64, "base64"));
        }
      } catch (error) {
        if (error instanceof GrocyBackupRestoreError) {
          throw error;
        }
        throw new GrocyBackupRestoreError("restore_write_failed", `Grocy backup restore verification could not write to ${restoreDir}.`, { cause: error });
      }
      restoredTo = restoreDir;
      updateBackupManifestRecord(baseDir, latest.id, {
        restoreTestStatus: "verified",
        restoreTestedAt: new Date().toISOString(),
        restoreFailureCategory: undefined,
      }, options.manifestPath);
    }
    return { archivePath, fileCount: bundle.files.length, totalBytes: bundle.files.reduce((sum, file) => sum + file.size, 0), checksumVerified, restoredTo };
  } catch (error) {
    if (error instanceof GrocyBackupRestoreError) {
      markRestoreFailure(baseDir, latest.id, error.category, options.manifestPath);
    }
    throw error;
  }
}

function writeJsonFileWithOverwrite(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  writeJsonFile(filePath, value);
  return filePath;
}

function normalizeDisplayPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toPublicSafePath(baseDir: string, targetPath: string): string {
  const absolutePath = path.resolve(baseDir, targetPath);
  const relativePath = path.relative(baseDir, absolutePath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? "[external-path-redacted]"
    : normalizeDisplayPath(relativePath);
}

function resolveRestorePlanItem(
  baseDir: string,
  restoreDirPath: string,
  file: BackupBundleFile,
): GrocyBackupRestorePlanDryRunReportItem {
  const targetPath = path.resolve(restoreDirPath, file.path);
  if (!isPathInside(restoreDirPath, targetPath)) {
    return {
      action: "blocked_path_escape",
      path: file.path,
      targetPath: toPublicSafePath(baseDir, targetPath),
      size: file.size,
      sha256: file.sha256,
      reason: "Archive entry would escape the requested restore directory.",
    };
  }
  const action = fs.existsSync(targetPath) ? "would_overwrite" : "would_create";
  return {
    action,
    path: file.path,
    targetPath: toPublicSafePath(baseDir, targetPath),
    size: file.size,
    sha256: file.sha256,
    reason: action === "would_overwrite"
      ? "Existing file would be replaced during a confirmed restore."
      : "File would be written during a confirmed restore.",
  };
}

function summarizeRestorePlan(
  items: GrocyBackupRestorePlanDryRunReportItem[],
): GrocyBackupRestorePlanDryRunReport["summary"] {
  const summary: GrocyBackupRestorePlanDryRunReport["summary"] = {
    result: "ready",
    checksumVerified: true,
    fileCount: items.length,
    totalBytes: items.reduce((sum, item) => sum + item.size, 0),
    wouldCreate: 0,
    wouldOverwrite: 0,
    blocked: 0,
  };
  for (const item of items) {
    if (item.action === "would_create") {
      summary.wouldCreate += 1;
      continue;
    }
    if (item.action === "would_overwrite") {
      summary.wouldOverwrite += 1;
      continue;
    }
    summary.blocked += 1;
  }
  if (summary.blocked > 0) {
    summary.result = "blocked";
  }
  return summary;
}

export function createGrocyBackupRestorePlanDryRunReport(
  baseDir: string = process.cwd(),
  options: {
    archivePath?: string;
    restoreDir: string;
    configPath?: string;
    manifestPath?: string;
    generatedAt?: string;
  },
): GrocyBackupRestorePlanDryRunReport {
  const config = loadBackupConfig(baseDir, options.configPath);
  const passphrase = requirePassphrase(config);
  const manifest = loadBackupManifest(baseDir, options.manifestPath);
  const record = loadBackupRecord(manifest, options.archivePath);
  if (!record) {
    throw new Error("No Grocy backup record found to plan a restore.");
  }
  const archivePath = path.resolve(record.archivePath);
  let archive: Buffer;
  try {
    archive = fs.readFileSync(archivePath);
  } catch (error) {
    throw new GrocyBackupRestoreError("archive_unreadable", `Grocy backup archive could not be read at ${archivePath}.`, { cause: error });
  }
  const bundle = decryptBundle(archive, passphrase);
  const checksumVerified = sha256(archive) === record.checksumSha256;
  if (!checksumVerified) {
    throw new GrocyBackupRestoreError("manifest_checksum_mismatch", `Grocy backup checksum verification failed for ${archivePath}.`);
  }
  const restoreDirPath = path.resolve(baseDir, options.restoreDir);
  const items = bundle.files.map((file) => resolveRestorePlanItem(baseDir, restoreDirPath, file));
  return GrocyBackupRestorePlanDryRunReportSchema.parse({
    kind: "grocy_backup_restore_plan_dry_run_report",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    archivePath: toPublicSafePath(baseDir, archivePath),
    archiveRecordId: record.id,
    restoreDir: toPublicSafePath(baseDir, restoreDirPath),
    summary: {
      ...summarizeRestorePlan(items),
      checksumVerified,
    },
    notes: [
      "This report inspects an existing encrypted archive and restore target without writing files.",
      "A real restore still requires an explicit follow-up verify command with --confirm-restore-write.",
    ],
    items,
  });
}

export function recordGrocyBackupRestorePlanDryRunReport(
  report: GrocyBackupRestorePlanDryRunReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFileWithOverwrite(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
