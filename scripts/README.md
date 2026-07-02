# Scripts

Utility scripts for the TorBox Manager codebase.

## i18n

| Script                        | Purpose                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `i18n-check-keys.js`          | Compare locale deltas against `en.json` and report missing/extra keys.                                                            |
| `i18n-prune-locale-deltas.js` | Strip keys from locale files that match `en.json` (keep only true deltas).                                                        |
| `i18n-merge-locale-patch.js`  | Deep-merge a patch JSON into a locale delta file. Useful when adding batches of translated keys without editing the file by hand. |
| `i18n-sort-locale-files.js`   | Recursively sort all keys in every locale JSON file for consistent ordering. Supports `--check` for CI.                           |

### Workflow for adding translations

1. Run `bun scripts/i18n-check-keys.js` to find missing keys per locale.
2. Create a patch JSON containing just the missing keys with their translations.
3. Merge it: `bun scripts/i18n-merge-locale-patch.js <locale> <patch.json>`
4. Optionally run `bun scripts/i18n-prune-locale-deltas.js` to clean redundant keys.
5. Re-run `bun scripts/i18n-check-keys.js` to verify.

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
