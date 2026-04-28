# Health And Diagnostics

Use health commands when CI, docs, operators, or agents need a stable machine-readable view of Grocy connectivity and setup state.

## Install Doctor

Run an install-doctor preflight after workspace setup or when a checkout behaves unexpectedly:

```bash
npm run grocy:install:doctor -- --output data/install-doctor.json --force
```

The install doctor checks Node.js, conventional local directories, starter config files, and first-run config gaps. It exits non-zero only for blocking failures such as unsupported Node.js or invalid local config JSON.

## Health Badge

Run the compact badge command when CI, docs, or an agent receipt needs a stable machine-readable health summary:

```bash
npm run grocy:health:badge
```

By default, badge output is written to:

```text
data/grocy-health-badge.json
```

The badge artifact keeps only the top-level status, checked components, and short failure codes. It intentionally omits verbose diagnostics, Grocy record contents, API keys, local absolute paths, and live URL values.

Use `--output <path>` to write the badge somewhere else.

## Diagnostics

Run diagnostics when health checks fail or when an agent-readable troubleshooting artifact is useful.

```bash
npm run grocy:health:diagnostics
```

By default, diagnostics are written to:

```text
data/grocy-health-diagnostics.json
```

The diagnostics artifact records reachability checks and next actions. It does not store Grocy record contents, API keys, absolute local paths, or live URL values.

It also records a bounded triage classification plus a short `nextActions` list so operators and automation can distinguish setup gaps, config repair work, and live API investigation without parsing free-form evidence.

Use `--output <path>` to write the artifact somewhere else.

## Synthetic Preview

When you want to preview the public health example shapes from a built checkout without adding a global install step, use the package bin through `npx --no-install`.

Build the package edge first:

```bash
npm install
npm run grocy:init:workspace
npm run build
```

Preview the health example artifacts without live Grocy credentials:

```bash
npx --no-install grocy-ops-toolkit grocy:health:badge --output data/preview-health-badge.json --force
npx --no-install grocy-ops-toolkit grocy:health:diagnostics --output data/preview-health-diagnostics.json --force
npx --no-install grocy-ops-toolkit grocy:install:doctor --output data/preview-install-doctor.json --force
```

Expected result: the health commands complete with public-safe `fail` outputs and the install doctor records first-run directory/config guidance in `data/preview-install-doctor.json`, matching the same artifact families as `examples/grocy-health-badge.example.json`, `examples/grocy-health-diagnostics.example.json`, and `examples/grocy-install-doctor.example.json`.
