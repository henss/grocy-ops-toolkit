# Multi-Instance Namespace Prototype

This prototype is a fixture-only proof that the toolkit's public defaults do not need to collapse into a single Grocy instance root.

The command emits a synthetic layout artifact for two example namespaces, then validates four invariants:

- each namespace resolves to a unique workspace root
- each namespace keeps the conventional `config/`, `data/`, `backups/`, and `restore/` directory names
- each namespace id uses lowercase letters, numbers, and hyphens so generated paths stay portable
- none of the namespace paths overlap or nest into another namespace

## Command

```bash
npm run grocy:namespace:prototype
```

By default, the command writes:

```text
data/grocy-multi-instance-namespace-prototype.json
```

## What It Shows

- Synthetic namespace roots such as `instances/demo-alpha` and `instances/demo-beta`
- Conventional local directories and config filenames inside each namespace root
- Machine-checkable validation results for root uniqueness, conventional path naming, namespace-id safety, and path separation
- Review notes that keep the artifact inside the public-safe support-infrastructure boundary

## Intended Use

Use this prototype when you need bounded evidence that:

- the toolkit can be organized under more than one instance root without mixing paths
- a future multi-instance layout discussion can start from a public-safe example instead of private household data
- validation can stay synthetic and CI-friendly without turning the toolkit into a broader multi-tenant product commitment

## Boundary Notes

Keep the prototype synthetic. Do not add live Grocy URLs, credentials, household details, shopping intent workflows, pantry-monitoring policy, calendar/task integrations, or operator-specific operating policy.

Namespace ids in this prototype should stay slug-like: use lowercase letters, numbers, and hyphens only. Do not use path separators, traversal segments, or hostnames.
