import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGrocyBackupSnapshot, verifyGrocyBackupSnapshot } from "../src/backups.js";

const envName = "GROCY_TEST_BACKUP_PASSPHRASE";

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

  it("rejects invalid archives during verification", () => {
    const baseDir = setupBackupBase();
    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    fs.writeFileSync(record.archivePath, "not valid", "utf8");

    expect(() => verifyGrocyBackupSnapshot(baseDir)).toThrow();
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
