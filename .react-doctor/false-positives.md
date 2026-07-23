# False Positives

## `react-doctor/nextjs-no-side-effect-in-get-handler`

`req.destroy()` on the `http.ClientRequest` variable (not the incoming Next.js `Request`) is standard Node.js timeout cleanup — not a CSRF-vulnerable side effect.

**Pattern:** `const req = http.get(...)` / `req.setTimeout(...)` then `req.destroy()` inside the timeout callback. The `req` is always the outgoing `http.ClientRequest`, not the incoming request parameter.

- `src/app/api/backend/status/route.js`
- `src/app/api/backend/api-key/status/route.js`
- `src/app/api/admin/verify/route.js`
- `src/app/api/automation/rules/route.js`
- `src/app/api/automation/rules/[id]/logs/route.js`
- `src/app/api/custom-views/route.js`
- `src/app/api/custom-views/[id]/route.js`
- `src/app/api/tags/route.js`
- `src/app/api/tags/[id]/route.js`
- `src/app/api/downloads/tags/route.js`
- `src/app/api/archived-downloads/route.js`

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
