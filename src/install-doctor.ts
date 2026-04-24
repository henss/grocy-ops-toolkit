import fs from "node:fs";
import path from "node:path";
import { GROCY_BACKUP_CONFIG_PATH } from "./backups.js";
import { DEFAULT_GROCY_CONFIG_PATH, loadGrocyLiveConfig } from "./grocy-live.js";
import {
  GrocyInstallDoctorArtifactSchema,
  type GrocyInstallDoctorArtifact,
  type GrocyInstallDoctorCheck,
} from "./schemas.js";

export const GROCY_INSTALL_DOCTOR_PATH = path.join("data", "grocy-install-doctor.json");
export const DEFAULT_GROCY_CONFIG_DIR = "config";
export const DEFAULT_GROCY_DATA_DIR = "data";
export const DEFAULT_GROCY_RESTORE_DIR = "restore";

interface GrocyBackupInstallConfigStatus {
  sourcePath: string;
  backupDir: string;
  passphraseEnv: string;
  locationLabel: string;
}

function createCheck(input: Omit<GrocyInstallDoctorCheck, "evidence"> & { evidence?: string[] }): GrocyInstallDoctorCheck {
  return {
    ...input,
    evidence: input.evidence ?? [],
  };
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function parseMajorVersion(version: string): number | undefined {
  const match = /^v?(\d+)/.exec(version.trim());
  return match ? Number.parseInt(match[1] ?? "", 10) : undefined;
}

function createDirectoryCheck(input: { baseDir: string; directoryPath: string; id: GrocyInstallDoctorCheck["id"] }): GrocyInstallDoctorCheck {
  const absolutePath = path.resolve(input.baseDir, input.directoryPath);
  if (!fs.existsSync(absolutePath)) {
    return createCheck({
      id: input.id,
      status: "warn",
      code: "directory_missing",
      message: `Conventional local directory ${input.directoryPath} is missing.`,
      action: `Create ${input.directoryPath} before running workflows that write local artifacts there.`,
    });
  }
  if (!fs.statSync(absolutePath).isDirectory()) {
    return createCheck({
      id: input.id,
      status: "fail",
      code: "directory_invalid",
      message: `Expected ${input.directoryPath} to be a directory.`,
      action: `Replace ${input.directoryPath} with a directory before running toolkit workflows.`,
    });
  }
  return createCheck({
    id: input.id,
    status: "pass",
    code: "directory_ready",
    message: `Conventional local directory ${input.directoryPath} is ready.`,
    action: "No action required.",
  });
}

function loadBackupInstallConfig(baseDir: string, configPath: string): GrocyBackupInstallConfigStatus | undefined {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Grocy backup config must be an object.");
  }
  const record = raw as Record<string, unknown>;
  const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : "";
  const backupDir = typeof record.backupDir === "string" ? record.backupDir.trim() : "";
  const passphraseEnv = typeof record.passphraseEnv === "string" && record.passphraseEnv.trim()
    ? record.passphraseEnv.trim()
    : "GROCY_BACKUP_PASSPHRASE";
  const locationLabel = typeof record.locationLabel === "string" && record.locationLabel.trim()
    ? record.locationLabel.trim()
    : "local-encrypted";
  if (!sourcePath || !backupDir) {
    throw new Error("Grocy backup config requires sourcePath and backupDir.");
  }
  return { sourcePath, backupDir, passphraseEnv, locationLabel };
}

function createNodeVersionCheck(nodeVersion: string): GrocyInstallDoctorCheck {
  const majorVersion = parseMajorVersion(nodeVersion);
  if (majorVersion === undefined) {
    return createCheck({
      id: "node_version",
      status: "fail",
      code: "node_version_unreadable",
      message: `Node.js version ${nodeVersion} could not be parsed.`,
      action: "Run the toolkit with Node.js 20 or newer.",
    });
  }
  if (majorVersion < 20) {
    return createCheck({
      id: "node_version",
      status: "fail",
      code: "node_version_unsupported",
      message: `Node.js ${nodeVersion} is below the supported >=20 requirement.`,
      action: "Upgrade Node.js to version 20 or newer, then rerun npm run grocy:install:doctor.",
    });
  }
  return createCheck({
    id: "node_version",
    status: "pass",
    code: "node_version_supported",
    message: `Node.js ${nodeVersion} satisfies the toolkit requirement.`,
    action: "No action required.",
  });
}

function createGrocyConfigCheck(baseDir: string, configPath: string): GrocyInstallDoctorCheck {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    const examplePath = fs.existsSync(path.resolve(baseDir, "examples", "grocy.local.example.json"))
      ? "Copy examples/grocy.local.example.json to config/grocy.local.json, then update baseUrl and apiKey."
      : "Create config/grocy.local.json with baseUrl, apiKey, and timeoutMs before running live Grocy commands.";
    return createCheck({
      id: "grocy_config",
      status: "warn",
      code: "grocy_config_missing",
      message: `Local Grocy config is missing at ${configPath}.`,
      action: examplePath,
    });
  }
  try {
    loadGrocyLiveConfig(baseDir, configPath);
    return createCheck({
      id: "grocy_config",
      status: "pass",
      code: "grocy_config_ready",
      message: `Local Grocy config is present and valid at ${configPath}.`,
      action: "No action required.",
    });
  } catch (error) {
    return createCheck({
      id: "grocy_config",
      status: "fail",
      code: "grocy_config_invalid",
      message: `Local Grocy config at ${configPath} is invalid.`,
      action: `Compare ${configPath} with the example shape and fix the validation error before running live commands.`,
      evidence: [error instanceof Error ? error.message : String(error)],
    });
  }
}

function createBackupConfigCheck(baseDir: string, configPath: string): GrocyInstallDoctorCheck {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    const examplePath = fs.existsSync(path.resolve(baseDir, "examples", "grocy-backup.local.example.json"))
      ? "Copy examples/grocy-backup.local.example.json to config/grocy-backup.local.json before running backup workflows."
      : "Create config/grocy-backup.local.json with sourcePath, backupDir, and passphraseEnv before running backup workflows.";
    return createCheck({
      id: "backup_config",
      status: "warn",
      code: "backup_config_missing",
      message: `Local backup config is missing at ${configPath}.`,
      action: examplePath,
    });
  }
  try {
    const config = loadBackupInstallConfig(baseDir, configPath);
    return createCheck({
      id: "backup_config",
      status: "pass",
      code: "backup_config_ready",
      message: `Local backup config is present and valid at ${configPath}.`,
      action: config
        ? `Confirm that ${config.sourcePath} and ${config.backupDir} match your local Grocy backup paths before running backup commands.`
        : "No action required.",
    });
  } catch (error) {
    return createCheck({
      id: "backup_config",
      status: "fail",
      code: "backup_config_invalid",
      message: `Local backup config at ${configPath} is invalid.`,
      action: `Fix ${configPath} so it defines sourcePath and backupDir before running backup workflows.`,
      evidence: [error instanceof Error ? error.message : String(error)],
    });
  }
}

function createBackupSourceCheck(baseDir: string, configPath: string): GrocyInstallDoctorCheck {
  try {
    const config = loadBackupInstallConfig(baseDir, configPath);
    if (!config) {
      return createCheck({
        id: "backup_source",
        status: "skipped",
        code: "backup_source_skipped",
        message: "Backup source path check was skipped because local backup config is missing.",
        action: `Create ${configPath} before running backup workflows.`,
      });
    }
    const sourceAbsolutePath = path.resolve(baseDir, config.sourcePath);
    if (!fs.existsSync(sourceAbsolutePath)) {
      return createCheck({
        id: "backup_source",
        status: "warn",
        code: "backup_source_missing",
        message: `Backup source path ${config.sourcePath} does not exist yet.`,
        action: "Point sourcePath at your local Grocy config/data directory before running backup commands.",
      });
    }
    return createCheck({
      id: "backup_source",
      status: "pass",
      code: "backup_source_ready",
      message: `Backup source path ${config.sourcePath} exists.`,
      action: "No action required.",
    });
  } catch {
    return createCheck({
      id: "backup_source",
      status: "skipped",
      code: "backup_source_skipped",
      message: "Backup source path check was skipped because local backup config is invalid.",
      action: `Fix ${configPath} before validating backup source paths.`,
    });
  }
}

export function createGrocyInstallDoctorArtifact(input: {
  baseDir?: string;
  generatedAt?: string;
  nodeVersion?: string;
  grocyConfigPath?: string;
  backupConfigPath?: string;
} = {}): GrocyInstallDoctorArtifact {
  const baseDir = input.baseDir ?? process.cwd();
  const nodeVersion = input.nodeVersion ?? process.version;
  const grocyConfigPath = input.grocyConfigPath ?? DEFAULT_GROCY_CONFIG_PATH;
  const backupConfigPath = input.backupConfigPath ?? GROCY_BACKUP_CONFIG_PATH;
  const checks: GrocyInstallDoctorCheck[] = [
    createNodeVersionCheck(nodeVersion),
    createDirectoryCheck({ baseDir, directoryPath: DEFAULT_GROCY_CONFIG_DIR, id: "config_dir" }),
    createDirectoryCheck({ baseDir, directoryPath: DEFAULT_GROCY_DATA_DIR, id: "data_dir" }),
    createDirectoryCheck({ baseDir, directoryPath: DEFAULT_GROCY_RESTORE_DIR, id: "restore_dir" }),
    createGrocyConfigCheck(baseDir, grocyConfigPath),
    createBackupConfigCheck(baseDir, backupConfigPath),
    createBackupSourceCheck(baseDir, backupConfigPath),
  ];
  const failureCount = checks.filter((check) => check.status === "fail").length;
  const warningCount = checks.filter((check) => check.status === "warn").length;
  const skippedCount = checks.filter((check) => check.status === "skipped").length;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const nextActions = checks
    .filter((check) => check.status !== "pass")
    .map((check) => check.action);

  return GrocyInstallDoctorArtifactSchema.parse({
    kind: "grocy_install_doctor",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    toolId: "grocy",
    summary: {
      status: failureCount > 0 || warningCount > 0 ? "action_required" : "ready",
      failureCount,
      warningCount,
      skippedCount,
      passCount,
    },
    checks,
    nextActions,
  });
}

export function runGrocyInstallDoctor(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string; nodeVersion?: string; grocyConfigPath?: string; backupConfigPath?: string } = {},
): GrocyInstallDoctorArtifact {
  return createGrocyInstallDoctorArtifact({
    baseDir,
    generatedAt: options.generatedAt,
    nodeVersion: options.nodeVersion,
    grocyConfigPath: options.grocyConfigPath,
    backupConfigPath: options.backupConfigPath,
  });
}

export function recordGrocyInstallDoctorArtifact(
  artifact: GrocyInstallDoctorArtifact,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_INSTALL_DOCTOR_PATH),
    artifact,
    options.overwrite ?? true,
  );
}
