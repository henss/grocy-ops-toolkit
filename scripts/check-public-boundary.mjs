import { execFileSync } from "node:child_process";

const forbiddenPathPatterns = [
  /^\.runtime(?:\/|$)/,
  /(?:^|\/)orchestrator-outcomes(?:\/|$)/,
];

const privateRepoPattern = new RegExp(`\\b(?:${["llm", "orchestrator"].join("-")}|${["personal", "ops"].join("-")})\\b`, "gi");
const privateWorkspacePattern = new RegExp(`${["D:", "workspace"].join("\\\\")}\\\\`, "i");

const forbiddenTextPatterns = [
  /\.runtime\/orchestrator-outcomes/i,
  /\.runtime\\orchestrator-outcomes/i,
  privateRepoPattern,
  privateWorkspacePattern,
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const trackedFiles = git(["ls-files"]);
const pathFindings = trackedFiles.filter((filePath) =>
  forbiddenPathPatterns.some((pattern) => pattern.test(filePath.replace(/\\/g, "/"))),
);

const textFindings = [];
for (const filePath of trackedFiles) {
  const content = execFileSync("git", ["show", `:${filePath}`], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  for (const pattern of forbiddenTextPatterns) {
    if (pattern.test(content)) {
      textFindings.push(`${filePath}: ${pattern}`);
    }
  }
}

if (pathFindings.length > 0 || textFindings.length > 0) {
  console.error("Public-boundary check failed.");
  for (const finding of pathFindings) {
    console.error(`- forbidden tracked path: ${finding}`);
  }
  for (const finding of textFindings) {
    console.error(`- forbidden tracked text: ${finding}`);
  }
  process.exit(1);
}

console.log("Public-boundary check passed.");
