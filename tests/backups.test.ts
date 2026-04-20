import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGrocyBackupSnapshot, verifyGrocyBackupSnapshot } from "../src/backups.js";

const envName = "GROCY_TEST_BACKUP_PASSPHRASE";
const fixtureSourcePath = path.resolve("examples", "synthetic-grocy-backup-source");

afterEach(() => {
  delete process.env[envName];
});

function setupBackupBase(): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-backup-"));
  fs.mkdirSync(path.join(baseDir, "source"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "source", "config.php"), "<?php return [];\n", "utf8");
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
    JSON.stringify({
      sourcePath: "source",
      backupDir: "backups",
      passphraseEnv: envName,
      locationLabel: "synthetic-local-encrypted",
    }),
    "utf8",
  );
  process.env[envName] = "synthetic-passphrase";
  return baseDir;
}

function writeBackupConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
    JSON.stringify({
      sourcePath: "source",
      backupDir: "backups",
      passphraseEnv: envName,
      locationLabel: "synthetic-local-encrypted",
    }),
    "utf8",
  );
  process.env[envName] = "synthetic-passphrase";
}

function readTreeContents(rootPath: string): Record<string, string> {
  const entries: Record<string, string> = {};
  function walk(currentPath: string): void {
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(currentPath).sort()) {
        walk(path.join(currentPath, child));
      }
      return;
    }
    entries[path.relative(rootPath, currentPath).replace(/\\/g, "/")] = fs.readFileSync(currentPath, "utf8");
  }
  walk(rootPath);
  return entries;
}

describe("Grocy backups", () => {
  it("creates and verifies encrypted backup archives", () => {
    const baseDir = setupBackupBase();

    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    const verification = verifyGrocyBackupSnapshot(baseDir);

    expect(fs.existsSync(record.archivePath)).toBe(true);
    expect(verification.checksumVerified).toBe(true);
    expect(verification.fileCount).toBe(1);
  });

  it("snapshots, verifies, and restores the public synthetic encrypted fixture loop", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-backup-fixture-"));
    fs.cpSync(fixtureSourcePath, path.join(baseDir, "source"), { recursive: true });
    writeBackupConfig(baseDir);

    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:10:00.000Z",
    });
    const sourceContents = readTreeContents(path.join(baseDir, "source"));
    const expectedBytes = Object.values(sourceContents).reduce((sum, content) => sum + Buffer.byteLength(content, "utf8"), 0);
    const archiveText = fs.readFileSync(record.archivePath, "utf8");
    const verification = verifyGrocyBackupSnapshot(baseDir, {
      restoreDir: "restore",
      confirmRestoreWrite: true,
    });

    expect(record.fileCount).toBe(2);
    expect(record.totalBytes).toBe(expectedBytes);
    expect(archiveText).toContain("grocy_backup_archive");
    expect(archiveText).not.toContain("Example oats");
    expect(archiveText).not.toContain("FEATURE_FLAG_SYNTHETIC_FIXTURE");
    expect(verification.checksumVerified).toBe(true);
    expect(verification.fileCount).toBe(2);
    expect(verification.restoredTo).toBe(path.join(baseDir, "restore"));
    expect(readTreeContents(path.join(baseDir, "restore"))).toEqual(sourceContents);
    const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-manifest.json"), "utf8")) as {
      records: Array<{ restoreTestStatus: string; restoreTestedAt?: string }>;
    };
    expect(manifest.records[0].restoreTestStatus).toBe("verified");
    expect(manifest.records[0].restoreTestedAt).toBeDefined();
  });

  it("rejects invalid archives during verification", () => {
    const baseDir = setupBackupBase();
    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    fs.writeFileSync(record.archivePath, "not valid", "utf8");

    expect(() => verifyGrocyBackupSnapshot(baseDir)).toThrow();
  });

  it("rejects archives whose manifest checksum does not match", () => {
    const baseDir = setupBackupBase();
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    const manifestPath = path.join(baseDir, "data", "grocy-backup-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { records: Array<{ checksumSha256: string }> };
    manifest.records[0].checksumSha256 = "0".repeat(64);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    expect(() => verifyGrocyBackupSnapshot(baseDir)).toThrow("checksum verification failed");
  });

  it("requires confirmation before writing restore files", () => {
    const baseDir = setupBackupBase();
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });

    expect(() => verifyGrocyBackupSnapshot(baseDir, { restoreDir: "restore" })).toThrow("confirm-restore-write");
  });

  it("uses caller-provided config and manifest paths for custom repo layouts", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-backup-custom-layout-"));
    fs.mkdirSync(path.join(baseDir, "source"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "private-config"), { recursive: true });
    fs.writeFileSync(path.join(baseDir, "source", "config.php"), "<?php return [];\n", "utf8");
    fs.writeFileSync(
      path.join(baseDir, "private-config", "grocy-backup.local.json"),
      JSON.stringify({
        sourcePath: "source",
        backupDir: "backups",
        passphraseEnv: envName,
      }),
      "utf8",
    );
    process.env[envName] = "synthetic-passphrase";

    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
      configPath: path.join("private-config", "grocy-backup.local.json"),
      manifestPath: path.join("manifests", "grocy-backup-manifest.json"),
    });

    expect(record.manifestPath).toBe(path.join(baseDir, "manifests", "grocy-backup-manifest.json"));
    expect(
      verifyGrocyBackupSnapshot(baseDir, {
        configPath: path.join("private-config", "grocy-backup.local.json"),
        manifestPath: path.join("manifests", "grocy-backup-manifest.json"),
      }).checksumVerified,
    ).toBe(true);
  });
});
