# Package Consumer Smoke

Use this workflow to prove that the public package edge works from a separate TypeScript consumer.

## Generated Workspace

Generate a disposable local tarball smoke workspace from a clean checkout:

```bash
npm run sample-consumer:smoke:workspace
```

The command builds the toolkit, creates a packed tarball, writes a disposable consumer workspace, installs the tarball without creating a `package-lock.json`, runs the installed-bin preview commands, compiles the synthetic TypeScript consumer, and executes the smoke contract. It prints a JSON summary with the workspace path plus the generated artifact paths.

To keep the workspace at a specific location instead of a temporary directory, pass `--output-dir`:

```bash
npm run sample-consumer:smoke:workspace -- --output-dir ../grocy-ops-toolkit-consumer
```

Expected result: the generated workspace contains synthetic config, data, backup, and restore inputs; the consumer compiles against the public exports; and the generated mock smoke report records `pass` without live Grocy credentials or private data.

## Manual Consumer Shape

Build the package edge and create a tarball:

```bash
npm install
npm run build
npm pack
```

Create a sibling consumer and install the tarball with TypeScript:

```bash
mkdir -p ../grocy-ops-toolkit-consumer
cd ../grocy-ops-toolkit-consumer
npm init -y
npm install --save-dev typescript
npm install ../grocy-ops-toolkit/grocy-ops-toolkit-0.1.0.tgz
```

Add a minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["consumer-contract.ts"]
}
```

Create `consumer-contract.ts` with a synthetic contract check:

```ts
import {
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  createGrocyReviewDashboard,
  runGrocyMockSmokeTest,
  type GrocyConfigExport,
  type GrocyConfigManifest,
} from "grocy-ops-toolkit";

const manifest: GrocyConfigManifest = {
  kind: "grocy_config_manifest",
  version: 1,
  updatedAt: "2026-04-20T09:30:00.000Z",
  notes: ["Synthetic package-consumer fixture."],
  items: [
    {
      key: "products.example-cocoa",
      entity: "products",
      name: "Example Cocoa",
      ownership: "repo_managed",
      fields: { min_stock_amount: 2, location: "Example Shelf" },
      aliases: [],
      provenance: { source: "synthetic-consumer-contract", notes: [] }
    }
  ]
};

const liveExport: GrocyConfigExport = {
  kind: "grocy_config_export",
  version: 1,
  exportedAt: "2026-04-20T09:31:00.000Z",
  source: { toolId: "grocy", grocyVersion: "synthetic" },
  counts: {
    products: 0,
    product_groups: 0,
    locations: 0,
    quantity_units: 0,
    product_barcodes: 0,
    shopping_lists: 0,
    shopping_list: 0
  },
  items: []
};

const plan = createGrocyConfigSyncPlan({
  manifest,
  liveExport,
  manifestPath: "config/desired-state.json",
  exportPath: "data/grocy-config-export.json",
  generatedAt: "2026-04-20T09:32:00.000Z",
});
createGrocyConfigApplyDryRunReport({
  plan,
  planPath: "data/grocy-config-sync-plan.json",
  generatedAt: "2026-04-20T09:33:00.000Z",
});
createGrocyReviewDashboard({
  generatedAt: "2026-04-20T09:34:00.000Z",
  plan,
});
const smokeReport = await runGrocyMockSmokeTest(".", {
  generatedAt: "2026-04-20T09:35:00.000Z",
});

console.log(smokeReport.summary.result);
```

Compile and run the consumer:

```bash
npx tsc -p tsconfig.json
node dist/consumer-contract.js
```

Expected result: the consumer compiles against the public exports and prints `pass` without live Grocy credentials or private data. The repo's packed-install coverage exercises the same synthetic package-consumer path during `npm test`.

## No-Install Example Preview

When you want to preview the public backup example shape from a built checkout without adding a global install step, use the package bin through `npx --no-install`.

```bash
npm install
npm run grocy:init:workspace
npm run build
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
export GROCY_BACKUP_PASSPHRASE="synthetic-preview-passphrase"
npx --no-install grocy-ops-toolkit grocy:backup:snapshot
npx --no-install grocy-ops-toolkit grocy:backup:restore-plan --restore-dir restore/preview-backup-check --output data/preview-backup-restore-plan-dry-run-report.json --force
```

PowerShell:

```powershell
npm run grocy:init:workspace
npm run build
Copy-Item examples/grocy-backup.local.example.json config/grocy-backup.local.json
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-preview-passphrase"
npx --no-install grocy-ops-toolkit grocy:backup:snapshot
npx --no-install grocy-ops-toolkit grocy:backup:restore-plan --restore-dir restore/preview-backup-check --output data/preview-backup-restore-plan-dry-run-report.json --force
```

Expected result: the restore-plan report stays no-write, records the synthetic files that would be restored, and matches the same artifact family as `examples/grocy-backup-restore-plan-dry-run-report.example.json`.
