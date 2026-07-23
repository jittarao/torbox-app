# False Positives

## `react-doctor/nextjs-no-side-effect-in-get-handler`

**Resolved:** Outbound HTTP client timeout cleanup (`req.destroy()` on `http.ClientRequest`) was moved into `src/utils/backendRequest.js` (`backendHttpGet` / `backendHttpRequest`). The rule falsely flags `.destroy()` inside GET route handlers even though it tears down the outgoing client socket, not server state on the incoming request.

## `react-doctor/no-mutable-in-deps`

`history.length` and `selectedLinks.size` refer to local reactive state (array `.length` and Set `.size`), not the mutable global `window.history`. The variable `history` is a local array from a custom hook, and `selectedLinks` is a `useState` Set.

- `src/components/LinkHistory/index.js:95:6` — `history.length` is local array length
- `src/components/LinkHistory/index.js:100:26` — `selectedLinks.size` is Set size

## `react-doctor/no-danger`

`dangerouslySetInnerHTML` for the theme-blocking script and analytics boot script is necessary in Next.js — there is no other way to inject inline JS that runs before React hydrates (prevents FOUC). The content is a static string literal (not user-supplied), so XSS risk is zero.

- `src/app/RootDocument.js:40:60` — theme FOUC prevention script
- `src/components/RybbitHeadScripts.js:17` — third-party analytics boot script

## `react-doctor/unused-dev-dependency`

`react-doctor` is listed as a devDependency and used in CI (`.github/workflows/react-doctor.yml`) via `npx react-doctor`. Not importable as a module — only used via CLI.

- `package.json` — `react-doctor` devDependency

## `react-doctor/async-await-in-loop`

The retry loop must run sequentially — each retry depends on the prior outcome and includes exponential backoff. Converting to `Promise.all` would fire all retries simultaneously, defeating the purpose.

- `src/utils/retryFetch.js:63:24` — exponential-backoff retry loop

The keyset-paginated download history fetch must iterate sequentially because each page's cursor depends on the previous response.

- `src/store/downloadHistoryStore.js:67:28` — keyset pagination with cursor dependency

The backend automation files use sequential iteration because operations depend on prior outcomes, aggregate cumulative state, or interact with rate-limited external APIs.

- `backend/src/automation/PollingScheduler.js:1128` — sequential user polling
- `backend/src/automation/AutomationEngine.js:582` — sequential rule processing
- `backend/src/automation/UploadProcessor.js:1009,1088` — sequential upload processing
- `backend/src/automation/helpers/RuleExecutor.js:67` — sequential rule execution
- `backend/src/automation/helpers/DatabaseRetryHelper.js:22` — sequential DB retries
- `backend/src/automation/GlobalActionQueue.js:189` — sequential action queue
- `backend/src/database/MigrationRunner.js:200` — sequential migration runner
- `backend/src/utils/fileStorage.js:298` — sequential file storage ops
- `src/app/api/lib/ffprobe-bootstrap.js:150` — sequential ffprobe bootstrapping

## `react-doctor/no-dynamic-import-path`

MigrationRunner dynamically imports migration files by their path — the path pattern is intentionally dynamic because migration filenames are not known at build time.

- `backend/src/database/MigrationRunner.js:200,276,357` — dynamic migration loading

## `react-doctor/effect-needs-cleanup`

The rule’s matcher does not trace teardown through local helpers, positive `if` branches, or async/nested callbacks, even when the effect returns a cleanup that releases every registered timer, listener, or subscription. Verified manually — no leak on unmount or dep change.

- `src/components/downloads/VideoPlayer.js` — DOM listeners and Shaka init each return `removeEventListener` / `clearTimeout` / `player.destroy()` teardown; seek listener registered inside async `initPlayer` is cleared in the same effect’s returned cleanup.
- `src/components/shared/hooks/useActivityBeacon.js` — `visibilitychange` listener and `setInterval` cleared in the effect return (`stopInterval` + `removeEventListener`).
- `src/components/shared/hooks/useAutomationEvents.js` — SSE uses `AbortController.abort()` plus `clearTimeout` for reconnect/debounce timers in the effect return (no `addEventListener`; rule message is generic).
- `src/components/shared/hooks/usePollTimer.js` — poll `setTimeout`s, SharedWorker `message` listener, and `useTorboxDownloadsStore.subscribe` all torn down in the returned cleanup (`clearTimeout`, `removeEventListener`, `unsubscribeQueue`).
- `src/components/shared/hooks/usePresenceAwarePollTimer.js` — poll `setTimeout` and presence/pause store unsubscribes cleared in the effect return.
