import { z } from "zod";

export const GrocySupportBundleIssueReportSchema = z.object({
  title: z.string().min(1),
  labels: z.array(z.string().min(1)).default([]),
  evidenceGroups: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    evidencePaths: z.array(z.string().min(1)).default([]),
    replayCommandIds: z.array(z.string().min(1)).default([]),
  })).default([]),
  bodyMarkdown: z.string().min(1),
  bodySections: z.array(z.object({
    heading: z.string().min(1),
    content: z.array(z.string().min(1)).default([]),
  })).default([]),
  attachmentChecklist: z.array(z.string().min(1)).default([]),
  replayCommands: z.array(z.object({
    id: z.string().min(1),
    command: z.string().min(1),
    purpose: z.string().min(1),
    evidencePaths: z.array(z.string().min(1)).default([]),
  })).default([]),
});

export type GrocySupportBundleIssueReport = z.infer<typeof GrocySupportBundleIssueReportSchema>;

export interface GrocySupportBundleIssueArtifact {
  path: string;
  kind?: string;
}

function matchingArtifactPaths(artifacts: GrocySupportBundleIssueArtifact[], kinds: string[]): string[] {
  const kindSet = new Set(kinds);
  return artifacts
    .filter((artifact) => artifact.kind && kindSet.has(artifact.kind))
    .map((artifact) => artifact.path);
}

function renderIssueReportMarkdown(input: Omit<GrocySupportBundleIssueReport, "bodyMarkdown">): string {
  const lines = [
    `# ${input.title}`,
    "",
    `Labels: ${input.labels.join(", ") || "support"}`,
    "",
  ];
  for (const section of input.bodySections) {
    lines.push(`## ${section.heading}`, "");
    for (const item of section.content) {
      lines.push(item, "");
    }
  }
  lines.push("## Evidence groups", "");
  for (const group of input.evidenceGroups) {
    lines.push(`- ${group.title}`);
    lines.push(`  Evidence: ${group.evidencePaths.join(", ") || "generated when this artifact family is present"}`);
    lines.push(`  Replay commands: ${group.replayCommandIds.join(", ") || "none"}`);
  }
  lines.push("");
  lines.push("## Attachment checklist", "");
  for (const item of input.attachmentChecklist) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push("", "## Replay commands", "");
  for (const command of input.replayCommands) {
    lines.push(`- ${command.id}: \`${command.command}\``);
    lines.push(`  Purpose: ${command.purpose}`);
    lines.push(`  Evidence: ${command.evidencePaths.join(", ") || "generated when this artifact is present"}`);
  }
  return `${lines.join("\n")}\n`;
}

export function createGrocySupportIssueReport(
  artifacts: GrocySupportBundleIssueArtifact[],
): GrocySupportBundleIssueReport {
  const healthPaths = matchingArtifactPaths(artifacts, ["grocy_health_diagnostics", "grocy_mock_smoke_report"]);
  const backupPaths = matchingArtifactPaths(artifacts, [
    "grocy_backup_manifest",
    "grocy_backup_verification_report",
    "grocy_backup_restore_drill_report",
    "grocy_backup_restore_failure_drill_report",
    "grocy_backup_integrity_receipt",
    "grocy_backup_integrity_receipt_verification",
  ]);
  const backupVerificationPaths = matchingArtifactPaths(artifacts, [
    "grocy_backup_verification_report",
    "grocy_backup_manifest",
  ]);
  const backupFailurePaths = matchingArtifactPaths(artifacts, ["grocy_backup_restore_failure_drill_report"]);
  const issueReport = {
    title: "Grocy health or backup debugging support request",
    labels: ["support", "grocy", "redacted-bundle"],
    evidenceGroups: [
      {
        id: "health",
        title: "Health diagnostics evidence",
        evidencePaths: healthPaths,
        replayCommandIds: ["health_diagnostics"],
      },
      {
        id: "backup_verification",
        title: "Encrypted backup verification evidence",
        evidencePaths: backupVerificationPaths,
        replayCommandIds: ["backup_verification"],
      },
      {
        id: "backup_failure_drill",
        title: "Backup failure replay evidence",
        evidencePaths: backupFailurePaths,
        replayCommandIds: ["backup_failure_drill"],
      },
      {
        id: "support_bundle",
        title: "Support bundle manifest",
        evidencePaths: ["data/grocy-support-bundle.json"],
        replayCommandIds: ["support_bundle"],
      },
    ],
    bodySections: [
      {
        heading: "Problem summary",
        content: [
          "Describe the failing command, observed status, and whether the issue affects health checks, backup verification, restore planning, or restore drills.",
        ],
      },
      {
        heading: "Attached evidence",
        content: [
          "Attach the generated support bundle JSON and any referenced public-safe artifacts listed in the bundle.",
          "Do not attach live Grocy exports, credentials, decrypted backup files, or unreviewed local logs.",
        ],
      },
      {
        heading: "Replay expectation",
        content: [
          "A maintainer should be able to rerun the listed npm commands against synthetic fixtures or reviewed redacted artifacts and compare the referenced checksums.",
        ],
      },
    ],
    attachmentChecklist: [
      "data/grocy-support-bundle.json",
      ...healthPaths,
      ...backupPaths,
    ],
    replayCommands: [
      {
        id: "health_diagnostics",
        command: "npm run grocy:health:diagnostics",
        purpose: "Refresh the public-safe health diagnostics artifact.",
        evidencePaths: healthPaths,
      },
      {
        id: "backup_verification",
        command: "npm run grocy:backup:verify -- --output data/grocy-backup-verification-report.json --force",
        purpose: "Refresh the public-safe encrypted-backup verification report without embedding decrypted file contents.",
        evidencePaths: backupVerificationPaths,
      },
      {
        id: "backup_failure_drill",
        command: "npm run grocy:backup:restore-failure-drill -- --restore-dir restore/grocy-restore-failure-drill",
        purpose: "Replay synthetic corruption, wrong-passphrase, and path-escape rejection evidence.",
        evidencePaths: backupFailurePaths,
      },
      {
        id: "support_bundle",
        command: "npm run grocy:support:bundle",
        purpose: "Regenerate the redacted manifest after refreshing diagnostics or backup evidence.",
        evidencePaths: ["data/grocy-support-bundle.json"],
      },
    ],
  } satisfies Omit<GrocySupportBundleIssueReport, "bodyMarkdown">;
  return GrocySupportBundleIssueReportSchema.parse({
    ...issueReport,
    bodyMarkdown: renderIssueReportMarkdown(issueReport),
  });
}
