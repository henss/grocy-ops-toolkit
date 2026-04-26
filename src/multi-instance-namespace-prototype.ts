import fs from "node:fs";
import path from "node:path";

export const GROCY_MULTI_INSTANCE_NAMESPACE_PROTOTYPE_PATH = path.join(
  "data",
  "grocy-multi-instance-namespace-prototype.json",
);

export interface GrocyMultiInstanceNamespacePrototypeNamespace {
  namespaceId: string;
  rootDir: string;
  configDir: string;
  dataDir: string;
  backupsDir: string;
  restoreDir: string;
  grocyConfigPath: string;
  backupConfigPath: string;
  notes: string[];
}

export interface GrocyMultiInstanceNamespacePrototypeValidation {
  id:
    | "namespace_roots_unique"
    | "conventional_local_paths"
    | "namespace_ids_safe_for_paths"
    | "namespace_paths_non_overlapping";
  status: "pass" | "fail";
  message: string;
  evidence: string[];
}

export interface GrocyMultiInstanceNamespacePrototypeArtifact {
  kind: "grocy_multi_instance_namespace_prototype";
  version: 1;
  generatedAt: string;
  scope: "synthetic_namespace_example";
  summary: {
    namespaceCount: number;
    validationStatus: "pass" | "fail";
    validationCount: number;
    passCount: number;
    failCount: number;
    overlappingPathCount: number;
  };
  namespaces: GrocyMultiInstanceNamespacePrototypeNamespace[];
  validations: GrocyMultiInstanceNamespacePrototypeValidation[];
  reviewNotes: string[];
}

function toPortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function createNamespaceEntry(namespaceId: string): GrocyMultiInstanceNamespacePrototypeNamespace {
  const rootDir = toPortablePath(path.join("instances", namespaceId));
  return {
    namespaceId,
    rootDir,
    configDir: toPortablePath(path.join(rootDir, "config")),
    dataDir: toPortablePath(path.join(rootDir, "data")),
    backupsDir: toPortablePath(path.join(rootDir, "backups")),
    restoreDir: toPortablePath(path.join(rootDir, "restore")),
    grocyConfigPath: toPortablePath(path.join(rootDir, "config", "grocy.local.json")),
    backupConfigPath: toPortablePath(path.join(rootDir, "config", "grocy-backup.local.json")),
    notes: [
      "Each namespace keeps the toolkit's conventional config, data, backups, and restore directories under its own root.",
      "This prototype proves layout separation only; it does not widen the public command surface into a broader multi-tenant contract.",
    ],
  };
}

function isSafeNamespaceId(namespaceId: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespaceId);
}

function createNamespaceIdValidation(
  namespaces: GrocyMultiInstanceNamespacePrototypeNamespace[],
): GrocyMultiInstanceNamespacePrototypeValidation {
  const invalidNamespaceIds = namespaces.flatMap((namespace) =>
    isSafeNamespaceId(namespace.namespaceId)
      ? []
      : [
        `${namespace.namespaceId} must use lowercase letters, numbers, and hyphens only so generated paths stay portable and cannot nest.`,
      ],
  );

  return {
    id: "namespace_ids_safe_for_paths",
    status: invalidNamespaceIds.length === 0 ? "pass" : "fail",
    message: invalidNamespaceIds.length === 0
      ? "Each namespace id stays portable and safe for direct path composition."
      : "One or more namespace ids would create ambiguous or nested local paths.",
    evidence: invalidNamespaceIds,
  };
}

function createOverlapValidation(
  namespaces: GrocyMultiInstanceNamespacePrototypeNamespace[],
): GrocyMultiInstanceNamespacePrototypeValidation {
  const seen: Array<{ path: string; owner: string }> = [];
  const overlaps: string[] = [];

  for (const namespace of namespaces) {
    for (const candidatePath of [
      namespace.rootDir,
      namespace.configDir,
      namespace.dataDir,
      namespace.backupsDir,
      namespace.restoreDir,
      namespace.grocyConfigPath,
      namespace.backupConfigPath,
    ]) {
      for (const existingPath of seen) {
        if (existingPath.owner === namespace.namespaceId) {
          continue;
        }
        if (existingPath.path === candidatePath) {
          overlaps.push(`${candidatePath} is shared by ${existingPath.owner} and ${namespace.namespaceId}.`);
          continue;
        }
        if (
          candidatePath.startsWith(`${existingPath.path}/`) ||
          existingPath.path.startsWith(`${candidatePath}/`)
        ) {
          overlaps.push(
            `${candidatePath} from ${namespace.namespaceId} nests inside ${existingPath.path} from ${existingPath.owner}.`,
          );
          continue;
        }
      }
      seen.push({ path: candidatePath, owner: namespace.namespaceId });
    }
  }

  return {
    id: "namespace_paths_non_overlapping",
    status: overlaps.length === 0 ? "pass" : "fail",
    message: overlaps.length === 0
      ? "Each namespace keeps distinct config, data, backup, restore, and local config file paths without nesting into another namespace."
      : "One or more namespace paths overlap and would collapse the isolation prototype.",
    evidence: overlaps,
  };
}

function createRootValidation(
  namespaces: GrocyMultiInstanceNamespacePrototypeNamespace[],
): GrocyMultiInstanceNamespacePrototypeValidation {
  const roots = namespaces.map((namespace) => namespace.rootDir);
  const duplicateRoots = roots.filter((rootDir, index) => roots.indexOf(rootDir) !== index);
  return {
    id: "namespace_roots_unique",
    status: duplicateRoots.length === 0 ? "pass" : "fail",
    message: duplicateRoots.length === 0
      ? "Each synthetic namespace example resolves to a unique workspace root."
      : "The prototype contains duplicate namespace roots.",
    evidence: duplicateRoots,
  };
}

function createConventionalPathValidation(
  namespaces: GrocyMultiInstanceNamespacePrototypeNamespace[],
): GrocyMultiInstanceNamespacePrototypeValidation {
  const invalidPaths = namespaces.flatMap((namespace) => {
    const failures: string[] = [];
    const expectedRoot = `instances/${namespace.namespaceId}`;
    if (namespace.rootDir !== expectedRoot) {
      failures.push(`${namespace.namespaceId} rootDir must be ${expectedRoot}.`);
    }
    if (namespace.configDir !== `${expectedRoot}/config`) {
      failures.push(`${namespace.namespaceId} configDir must end with /config.`);
    }
    if (namespace.dataDir !== `${expectedRoot}/data`) {
      failures.push(`${namespace.namespaceId} dataDir must end with /data.`);
    }
    if (namespace.backupsDir !== `${expectedRoot}/backups`) {
      failures.push(`${namespace.namespaceId} backupsDir must end with /backups.`);
    }
    if (namespace.restoreDir !== `${expectedRoot}/restore`) {
      failures.push(`${namespace.namespaceId} restoreDir must end with /restore.`);
    }
    if (namespace.grocyConfigPath !== `${expectedRoot}/config/grocy.local.json`) {
      failures.push(`${namespace.namespaceId} grocyConfigPath must use the conventional local filename.`);
    }
    if (namespace.backupConfigPath !== `${expectedRoot}/config/grocy-backup.local.json`) {
      failures.push(`${namespace.namespaceId} backupConfigPath must use the conventional local filename.`);
    }
    return failures;
  });

  return {
    id: "conventional_local_paths",
    status: invalidPaths.length === 0 ? "pass" : "fail",
    message: invalidPaths.length === 0
      ? "Every namespace example keeps the toolkit's conventional local directory and config filenames."
      : "One or more namespace examples drifted away from the toolkit's conventional local paths.",
    evidence: invalidPaths,
  };
}

export function createGrocyMultiInstanceNamespacePrototype(
  options: {
    generatedAt?: string;
    namespaceIds?: string[];
  } = {},
): GrocyMultiInstanceNamespacePrototypeArtifact {
  const namespaceIds = options.namespaceIds ?? ["demo-alpha", "demo-beta"];
  const namespaces = namespaceIds.map(createNamespaceEntry);
  const validations = [
    createRootValidation(namespaces),
    createConventionalPathValidation(namespaces),
    createNamespaceIdValidation(namespaces),
    createOverlapValidation(namespaces),
  ];
  const failCount = validations.filter((validation) => validation.status === "fail").length;
  const overlapValidation = validations.find((validation) => validation.id === "namespace_paths_non_overlapping");

  return {
    kind: "grocy_multi_instance_namespace_prototype",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "synthetic_namespace_example",
    summary: {
      namespaceCount: namespaces.length,
      validationStatus: failCount === 0 ? "pass" : "fail",
      validationCount: validations.length,
      passCount: validations.length - failCount,
      failCount,
      overlappingPathCount: overlapValidation?.evidence.length ?? 0,
    },
    namespaces,
    validations,
    reviewNotes: [
      "This artifact is a synthetic layout proof for multiple Grocy instance namespaces and contains no live Grocy data, credentials, or private domestic details.",
      "The prototype keeps conventional local paths inside each namespace root instead of redefining the toolkit's public defaults.",
      "Treat this as support-infrastructure validation, not as a broader package publication or multi-tenant API commitment.",
    ],
  };
}

export function recordGrocyMultiInstanceNamespacePrototype(
  artifact: GrocyMultiInstanceNamespacePrototypeArtifact,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_MULTI_INSTANCE_NAMESPACE_PROTOTYPE_PATH),
    artifact,
    options.overwrite ?? true,
  );
}
