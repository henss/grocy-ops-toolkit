import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROCY_BACKUPS_DIR,
  initializeGrocyWorkspace,
} from "../src/init-workspace.js";

describe("Grocy workspace init", () => {
  it("creates conventional directories and starter config files without relying on repo examples", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-init-workspace-"));

    const result = initializeGrocyWorkspace(baseDir);

    expect(result.directories).toEqual([
      { path: "config", status: "created" },
      { path: "data", status: "created" },
      { path: DEFAULT_GROCY_BACKUPS_DIR, status: "created" },
      { path: "restore", status: "created" },
    ]);
    expect(result.files).toEqual([
      { path: "config/grocy.local.json", status: "written" },
      { path: "config/grocy-backup.local.json", status: "written" },
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "config", "grocy.local.json"), "utf8"))).toEqual({
      baseUrl: "https://grocy.example.com/api",
      apiKey: "YOUR_GROCY_API_KEY",
      timeoutMs: 10000,
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "config", "grocy-backup.local.json"), "utf8"))).toEqual({
      sourcePath: "./path-to-local-grocy-data",
      backupDir: "./backups/grocy",
      passphraseEnv: "GROCY_BACKUP_PASSPHRASE",
      locationLabel: "local-encrypted",
    });
  });

  it("preserves existing local config files unless force is requested", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-init-workspace-existing-"));
    fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, "config", "grocy.local.json"),
      `${JSON.stringify({ baseUrl: "https://local.example.test/api", apiKey: "local-key", timeoutMs: 2000 }, null, 2)}\n`,
      "utf8",
    );

    const result = initializeGrocyWorkspace(baseDir);

    expect(result.files).toContainEqual({
      path: "config/grocy.local.json",
      status: "skipped",
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "config", "grocy.local.json"), "utf8"))).toEqual({
      baseUrl: "https://local.example.test/api",
      apiKey: "local-key",
      timeoutMs: 2000,
    });
  });

  it("overwrites starter config files when force is requested", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-init-workspace-force-"));
    fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, "config", "grocy.local.json"),
      `${JSON.stringify({ baseUrl: "https://old.example.test/api", apiKey: "old-key", timeoutMs: 1234 }, null, 2)}\n`,
      "utf8",
    );

    const result = initializeGrocyWorkspace(baseDir, { overwrite: true });

    expect(result.files).toContainEqual({
      path: "config/grocy.local.json",
      status: "overwritten",
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "config", "grocy.local.json"), "utf8"))).toEqual({
      baseUrl: "https://grocy.example.com/api",
      apiKey: "YOUR_GROCY_API_KEY",
      timeoutMs: 10000,
    });
  });
});
