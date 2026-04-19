import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GrocyBackupManifestSchema,
  GrocyBackupRecordSchema,
  type GrocyBackupManifest,
  type GrocyBackupRecord,
} from "./schemas.js";

export const GROCY_BACKUP_CONFIG_PATH = path.join("config", "grocy-backup.local.json");
export const GROCY_BACKUP_MANIFEST_PATH = path.join("data", "grocy-backup-manifest.json");

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

function loadBackupConfig(baseDir: string): GrocyBackupLocalConfig {
  const configPath = path.resolve(baseDir, GROCY_BACKUP_CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Grocy backup config is missing at ${configPath}.`);
  }
  const parsed = parseBackupConfig(readJsonFile(configPath));
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
  const payload = JSON.parse(archive.toString("utf8")) as Record<string, string | number>;
  if (payload.kind !== "grocy_backup_archive" || payload.version !== 1 || payload.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported Grocy backup archive format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, Buffer.from(String(payload.salt), "base64")),
    Buffer.from(String(payload.iv), "base64"),
  );
  decipher.setAuthTag(Buffer.from(String(payload.tag), "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(String(payload.ciphertext), "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as BackupBundle;
}

function loadBackupManifest(baseDir: string): GrocyBackupManifest {
  const manifestPath = path.resolve(baseDir, GROCY_BACKUP_MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    return { kind: "grocy_backup_manifest", version: 1, updatedAt: new Date().toISOString(), records: [] };
  }
  return GrocyBackupManifestSchema.parse(readJsonFile(manifestPath));
}

function recordBackupManifest(baseDir: string, record: GrocyBackupRecord): string {
  const manifestPath = path.resolve(baseDir, GROCY_BACKUP_MANIFEST_PATH);
  const current = loadBackupManifest(baseDir);
  const updated = GrocyBackupManifestSchema.parse({
    kind: "grocy_backup_manifest",
    version: 1,
    updatedAt: new Date().toISOString(),
    records: [record, ...current.records.filter((item) => item.id !== record.id)],
  });
  writeJsonFile(manifestPath, updated);
  return manifestPath;
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
  options: { createdAt?: string } = {},
): GrocyBackupRecord & { manifestPath: string } {
  const config = loadBackupConfig(baseDir);
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
  return { ...record, manifestPath: recordBackupManifest(baseDir, record) };
}

export function verifyGrocyBackupSnapshot(
  baseDir: string = process.cwd(),
  options: { archivePath?: string; restoreDir?: string; confirmRestoreWrite?: boolean } = {},
): { archivePath: string; fileCount: number; totalBytes: number; checksumVerified: boolean; restoredTo?: string } {
  const config = loadBackupConfig(baseDir);
  const passphrase = requirePassphrase(config);
  const manifest = loadBackupManifest(baseDir);
  const latest = options.archivePath
    ? manifest.records.find((record) => path.resolve(record.archivePath) === path.resolve(options.archivePath!))
    : manifest.records[0];
  if (!latest) {
    throw new Error("No Grocy backup record found to verify.");
  }
  const archivePath = path.resolve(latest.archivePath);
  const archive = fs.readFileSync(archivePath);
  const bundle = decryptBundle(archive, passphrase);
  const checksumVerified = sha256(archive) === latest.checksumSha256;
  for (const file of bundle.files) {
    const content = Buffer.from(file.contentBase64, "base64");
    if (sha256(content) !== file.sha256) {
      throw new Error(`Grocy backup verification failed for ${file.path}.`);
    }
  }
  let restoredTo: string | undefined;
  if (options.restoreDir) {
    if (!options.confirmRestoreWrite) {
      throw new Error("Refusing restore verification write without --confirm-restore-write.");
    }
    const restoreDir = path.resolve(baseDir, options.restoreDir);
    fs.mkdirSync(restoreDir, { recursive: true });
    for (const file of bundle.files) {
      const target = path.resolve(restoreDir, file.path);
      if (!target.startsWith(restoreDir)) {
        throw new Error(`Refusing to restore path outside target directory: ${file.path}`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(file.contentBase64, "base64"));
    }
    restoredTo = restoreDir;
  }
  return { archivePath, fileCount: bundle.files.length, totalBytes: bundle.files.reduce((sum, file) => sum + file.size, 0), checksumVerified, restoredTo };
}
