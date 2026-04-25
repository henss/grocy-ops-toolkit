import fs from "node:fs";
import path from "node:path";
import {
  GrocyBackupRetentionHistorySchema,
  GrocyBackupRetentionSimulationReportSchema,
  type GrocyBackupRetentionBucket,
  type GrocyBackupRetentionHistory,
  type GrocyBackupRetentionPolicy,
  type GrocyBackupRetentionSimulationReport,
  type GrocyBackupRetentionSimulationSnapshot,
  type GrocyBackupRetentionSnapshotHistoryEntry,
} from "./backup-retention-simulation-schema.js";

export const GROCY_BACKUP_RETENTION_SIMULATION_REPORT_PATH = path.join(
  "data",
  "grocy-backup-retention-simulation-report.json",
);

interface SnapshotSelection {
  retainedIds: Set<string>;
  retainedBySnapshotId: Map<string, Set<GrocyBackupRetentionBucket>>;
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

function getIsoWeekKey(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getBucketKey(snapshot: GrocyBackupRetentionSnapshotHistoryEntry, bucket: Exclude<GrocyBackupRetentionBucket, "latest">): string {
  const createdAt = new Date(snapshot.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error(`Snapshot ${snapshot.id} has an invalid createdAt value: ${snapshot.createdAt}`);
  }
  if (bucket === "hourly") {
    return snapshot.createdAt.slice(0, 13);
  }
  if (bucket === "daily") {
    return snapshot.createdAt.slice(0, 10);
  }
  if (bucket === "weekly") {
    return getIsoWeekKey(createdAt);
  }
  return snapshot.createdAt.slice(0, 7);
}

function addRetentionReason(selection: SnapshotSelection, snapshotId: string, reason: GrocyBackupRetentionBucket): void {
  selection.retainedIds.add(snapshotId);
  const current = selection.retainedBySnapshotId.get(snapshotId) ?? new Set<GrocyBackupRetentionBucket>();
  current.add(reason);
  selection.retainedBySnapshotId.set(snapshotId, current);
}

function selectRetainedSnapshots(
  snapshots: GrocyBackupRetentionSnapshotHistoryEntry[],
  policy: GrocyBackupRetentionPolicy,
): SnapshotSelection {
  const descendingSnapshots = [...snapshots].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );
  const selection: SnapshotSelection = {
    retainedIds: new Set<string>(),
    retainedBySnapshotId: new Map<string, Set<GrocyBackupRetentionBucket>>(),
  };

  const newestSnapshot = descendingSnapshots[0];
  if (newestSnapshot) {
    addRetentionReason(selection, newestSnapshot.id, "latest");
  }

  for (const [bucket, keepCount] of Object.entries(policy) as Array<[Exclude<GrocyBackupRetentionBucket, "latest">, number]>) {
    if (keepCount <= 0) {
      continue;
    }
    const seenKeys = new Set<string>();
    for (const snapshot of descendingSnapshots) {
      const key = getBucketKey(snapshot, bucket);
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      addRetentionReason(selection, snapshot.id, bucket);
      if (seenKeys.size >= keepCount) {
        break;
      }
    }
  }

  return selection;
}

function toSimulationSnapshot(
  snapshot: GrocyBackupRetentionSnapshotHistoryEntry,
  retainedBySnapshotId: Map<string, Set<GrocyBackupRetentionBucket>>,
): GrocyBackupRetentionSimulationSnapshot {
  const retainedBy = [...(retainedBySnapshotId.get(snapshot.id) ?? new Set<GrocyBackupRetentionBucket>())].sort();
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    logicalBytes: snapshot.logicalBytes,
    storedBytes: snapshot.storedBytes,
    retained: retainedBy.length > 0,
    retainedBy,
    notes: snapshot.notes,
  };
}

function bytesToGiB(bytes: number): number {
  return bytes / (1024 ** 3);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function createTimeline(
  snapshots: GrocyBackupRetentionSnapshotHistoryEntry[],
  history: GrocyBackupRetentionHistory,
): GrocyBackupRetentionSimulationReport["timeline"] {
  const ascendingSnapshots = [...snapshots].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );

  return ascendingSnapshots.map((snapshot, index) => {
    const selection = selectRetainedSnapshots(ascendingSnapshots.slice(0, index + 1), history.policy);
    const retainedSnapshots = ascendingSnapshots.filter((candidate) => selection.retainedIds.has(candidate.id));
    const retainedStoredBytes = retainedSnapshots.reduce((sum, candidate) => sum + candidate.storedBytes, 0);
    const retainedLogicalBytes = retainedSnapshots.reduce((sum, candidate) => sum + candidate.logicalBytes, 0);

    return {
      evaluatedAt: snapshot.createdAt,
      snapshotId: snapshot.id,
      retainedSnapshotCount: retainedSnapshots.length,
      retainedStoredBytes,
      retainedLogicalBytes,
      estimatedMonthlyCost: roundCurrency(bytesToGiB(retainedStoredBytes) * history.pricing.storagePricePerGiBMonth),
    };
  });
}

export function createGrocyBackupRetentionSimulationReport(
  baseDir: string = process.cwd(),
  options: {
    historyPath: string;
    generatedAt?: string;
  },
): GrocyBackupRetentionSimulationReport {
  const absoluteHistoryPath = path.resolve(baseDir, options.historyPath);
  const history = GrocyBackupRetentionHistorySchema.parse(readJsonFile(absoluteHistoryPath));
  const ascendingSnapshots = [...history.snapshots].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
  const selection = selectRetainedSnapshots(ascendingSnapshots, history.policy);
  const retainedSnapshots = ascendingSnapshots
    .filter((snapshot) => selection.retainedIds.has(snapshot.id))
    .map((snapshot) => toSimulationSnapshot(snapshot, selection.retainedBySnapshotId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const expiredSnapshots = ascendingSnapshots
    .filter((snapshot) => !selection.retainedIds.has(snapshot.id))
    .map((snapshot) => toSimulationSnapshot(snapshot, selection.retainedBySnapshotId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const timeline = createTimeline(ascendingSnapshots, history);
  const retainedStoredBytes = retainedSnapshots.reduce((sum, snapshot) => sum + snapshot.storedBytes, 0);
  const retainedLogicalBytes = retainedSnapshots.reduce((sum, snapshot) => sum + snapshot.logicalBytes, 0);
  const estimatedMonthlyCost = roundCurrency(bytesToGiB(retainedStoredBytes) * history.pricing.storagePricePerGiBMonth);

  return GrocyBackupRetentionSimulationReportSchema.parse({
    kind: "grocy_backup_retention_simulation_report",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "synthetic_fixture_only",
    historyPath: toPublicSafePath(baseDir, absoluteHistoryPath),
    policy: history.policy,
    pricing: history.pricing,
    summary: {
      snapshotCount: ascendingSnapshots.length,
      retainedSnapshotCount: retainedSnapshots.length,
      expiredSnapshotCount: expiredSnapshots.length,
      retainedStoredBytes,
      retainedLogicalBytes,
      peakRetainedStoredBytes: timeline.reduce((peak, entry) => Math.max(peak, entry.retainedStoredBytes), 0),
      estimatedMonthlyCost,
      estimatedAnnualCost: roundCurrency(estimatedMonthlyCost * 12),
    },
    retainedSnapshots,
    expiredSnapshots,
    timeline,
    reviewNotes: [
      "This simulator is synthetic-only and expects invented snapshot histories rather than live Grocy backups.",
      "storedBytes models the deduplicated physical footprint attributed to each retained snapshot, while logicalBytes models the full recoverable payload size.",
      ...history.reviewNotes,
    ],
  });
}

export function recordGrocyBackupRetentionSimulationReport(
  report: GrocyBackupRetentionSimulationReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_RETENTION_SIMULATION_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
