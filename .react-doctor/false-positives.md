# False Positives

Patterns react-doctor may flag incorrectly. Suppress a match only after verifying the cited code shape still holds.

## `react-doctor/no-mutable-in-deps`

The rule treats any deps root named `history` as `window.history`. Here `history` is a local array from `useLinkHistory`, so `history.length` in `useMemo` deps is reactive and correct.

- `src/components/LinkHistory/index.js` — `history.length` in `allSelected` / `someSelected` deps

## `react-doctor/no-danger`

Static, non-user-controlled inline scripts required before React hydrates. No XSS vector.

- `src/app/RootDocument.js` — theme FOUC prevention script
- `src/components/RybbitHeadScripts.js` — analytics boot script

## `react-doctor/unused-dev-dependency`

`react-doctor` is a CLI (`bun run doctor` and CI), not an importable module.

- `package.json` — `react-doctor` devDependency

## Native `<dialog>` / `showModal` inside `ModalOverlay`

Do **not** convert `ModalSheet` (or other `ModalOverlay` panels) to native `<dialog showModal()>`.
`showModal()` promotes the panel to the browser top layer and escapes the shared stacking
context that `ModalOverlay` uses for backdrop + panel. Chromium often still paints; WKWebView
(Tauri macOS) does not — modals appear empty or show only solid button chrome.

Keep `div[role="dialog"][aria-modal="true"]` inside `ModalOverlay`. Standalone native dialogs
(e.g. `DesktopConfirmDialog`, `ui-confirm-dialog`) without `ModalOverlay` remain fine.

- `src/components/shared/ModalSheet.js`
- `src/components/downloads/MoreOptionsMenuPanel.js`
- `src/components/navigation/MobileMoreSheet.js`

## `react-doctor/async-await-in-loop`

Sequential `await` is required: each iteration depends on the prior result (backoff retries, keyset cursors, ordered migrations, early-return search).

- `src/utils/retryFetch.js` — exponential-backoff retries
- `src/store/downloadHistoryStore.js` — keyset pagination
- `backend/src/automation/helpers/DatabaseRetryHelper.js` — transient DB retries
- `backend/src/database/MigrationRunner.js` — ordered migration apply
- `src/app/api/lib/ffprobe-bootstrap.js` — sequential directory probe with early return

## `react-doctor/no-dynamic-import-path`

Migration filenames are discovered at runtime from the migrations directory; a static literal import path is impossible.

- `backend/src/database/MigrationRunner.js` — `import(migrationUrl)` for apply / rollback / ensure
