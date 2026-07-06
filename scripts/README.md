# Scripts

Utility scripts for the TorBox Manager codebase.

## i18n

Single CLI at [`i18n.js`](i18n.js) with three commands. See [`src/i18n/README.md`](../src/i18n/README.md) for the agent workflow.

| Command     | npm script           | Purpose                                                   |
| ----------- | -------------------- | --------------------------------------------------------- |
| `translate` | `bun i18n:translate` | Plan pending keys (JSON) or `--apply` merged translations |
| `sync`      | `bun i18n:sync`      | Mechanical normalize: prune, sort, drop orphans           |
| `verify`    | `bun i18n:verify`    | CI gate: JSON, ICU, delta purity, sort order              |

```bash
bun i18n:translate --json > /tmp/i18n-work.json
# agent translates in-context
bun i18n:translate --apply /tmp/i18n-work.json
bun i18n:verify
```

## Version

| Script              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `update-version.js` | Update version across package.json and other config files. |

## Build / CI

| Script                     | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `analyze-bundle.js`        | Analyze production bundle size.         |
| `split-icons.mjs`          | Split icon sets for optimized loading.  |
| `apply-torbox-fetch.js`    | Apply TorBox fetch patches.             |
| `refactor-admin-pages.mjs` | One-off admin page refactoring utility. |
