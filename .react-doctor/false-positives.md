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
