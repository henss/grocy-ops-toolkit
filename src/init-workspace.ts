import fs from "node:fs";
import path from "node:path";
import { GROCY_BACKUP_CONFIG_PATH } from "./backups.js";
import {
  DEFAULT_GROCY_CONFIG_DIR,
  DEFAULT_GROCY_DATA_DIR,
  DEFAULT_GROCY_RESTORE_DIR,
} from "./install-doctor.js";
import { DEFAULT_GROCY_CONFIG_PATH } from "./grocy-live.js";

export const DEFAULT_GROCY_BACKUPS_DIR = "backups";

export interface GrocyWorkspaceInitResult {
  baseDir: string;
  directories: Array<{
    path: string;
    status: "created" | "existing";
  }>;
  files: Array<{
    path: string;
    status: "written" | "overwritten" | "skipped";
  }>;
  nextActions: string[];
}

const STARTER_GROCY_CONFIG = {
  baseUrl: "https://grocy.example.com/api",
  apiKey: "YOUR_GROCY_API_KEY",
  timeoutMs: 10000,
};

const STARTER_GROCY_BACKUP_CONFIG = {
  sourcePath: "./path-to-local-grocy-data",
  backupDir: "./backups/grocy",
  passphraseEnv: "GROCY_BACKUP_PASSPHRASE",
  locationLabel: "local-encrypted",
};

function toPortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function initializeGrocyWorkspace(
  baseDir: string = process.cwd(),
  options: { overwrite?: boolean } = {},
): GrocyWorkspaceInitResult {
  const overwrite = options.overwrite ?? false;
  const directories = [
    DEFAULT_GROCY_CONFIG_DIR,
    DEFAULT_GROCY_DATA_DIR,
    DEFAULT_GROCY_BACKUPS_DIR,
    DEFAULT_GROCY_RESTORE_DIR,
  ].map((relativePath) => {
    const absolutePath = path.resolve(baseDir, relativePath);
    const existed = fs.existsSync(absolutePath);
    fs.mkdirSync(absolutePath, { recursive: true });
    return {
      path: toPortablePath(relativePath),
      status: existed ? "existing" : "created",
    } as const;
  });

  const files = [
    { relativePath: DEFAULT_GROCY_CONFIG_PATH, contents: STARTER_GROCY_CONFIG },
    { relativePath: GROCY_BACKUP_CONFIG_PATH, contents: STARTER_GROCY_BACKUP_CONFIG },
  ].map(({ relativePath, contents }) => {
    const absolutePath = path.resolve(baseDir, relativePath);
    const existed = fs.existsSync(absolutePath);
    if (existed && !overwrite) {
      return {
        path: toPortablePath(relativePath),
        status: "skipped",
      } as const;
    }
    writeJsonFile(absolutePath, contents);
    return {
      path: toPortablePath(relativePath),
      status: existed ? "overwritten" : "written",
    } as const;
  });

  return {
    baseDir,
    directories,
    files,
    nextActions: [
      `Update ${toPortablePath(DEFAULT_GROCY_CONFIG_PATH)} with your Grocy baseUrl and apiKey before running live health or config commands.`,
      `Update ${toPortablePath(GROCY_BACKUP_CONFIG_PATH)} with your local Grocy sourcePath before running backup commands.`,
      "Rerun npm run grocy:install:doctor to confirm the starter workspace and any remaining local gaps.",
    ],
  };
}
