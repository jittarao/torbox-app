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

| Script                            | Purpose                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `update-version.js`               | Bump or set **web** and/or **desktop** semver (see scopes below).                |
| `generate-desktop-latest-json.js` | Build Tauri updater `latest.json` from staged `.tar.gz` / `.nsis.zip` artifacts. |

Scopes (flags: `--web` default, `--desktop`, `--all`):

- **Web** — `package.json`, `backend/package.json` (hosted deploys)
- **Desktop** — `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (installer releases)

```bash
bun run version:show              # web + desktop
bun run version:patch             # web only
bun run version:desktop:patch     # desktop shell only
bun run version:all:patch         # both tracks together
```

## Build / CI

| Script                     | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `analyze-bundle.js`        | Analyze production bundle size.         |
| `split-icons.mjs`          | Split icon sets for optimized loading.  |
| `apply-torbox-fetch.js`    | Apply TorBox fetch patches.             |
| `refactor-admin-pages.mjs` | One-off admin page refactoring utility. |
