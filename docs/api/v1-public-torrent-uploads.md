---
api_version: v1
surface: public-torrent-upload-queue
base_path: /api/v1
requires_backend: true
auth:
  - Authorization: Bearer <torbox_api_key>
  - x-api-key: <torbox_api_key>
implementation_roots:
  - src/app/api/v1/torrents/createtorrent/route.js
  - src/app/api/v1/torrents/batch/route.js
  - src/app/api/v1/uploads/[id]/route.js
  - src/app/api/lib/queueTorrentUpload.js
  - src/app/api/lib/publicTorrentBatchUpload.js
  - src/app/api/lib/publicUploadResponse.js
  - backend/src/routes/uploads.js
  - backend/src/automation/UploadProcessor.js
---

# Public torrent upload queue API (v1)

TorBox-compatible **async torrent upload** surface for integrations and coding agents. Requests are accepted immediately, stored in the self-hosted backend upload queue, processed in the background, and polled for TorBox `createtorrent` results (`hash`, `torrent_id`, `auth_id`).

This is **not** a passthrough to `api.torbox.app` — it requires the TorBox Manager backend (`BACKEND_URL`, backend not disabled).

## TBM queue status vs TorBox torrent status

Third-party integrations must treat these as **two different status systems**:

| | TBM upload queue (`GET /api/v1/uploads/:id`) | TorBox API (`api.torbox.app`) |
|---|---------------------------------------------|-------------------------------|
| **What it tracks** | Whether TBM accepted, processed, and submitted your upload | Whether the torrent exists on TorBox and its download/cache state |
| **Source** | Per-user SQLite `uploads` table (local backend) | TorBox cloud |
| **Typical values** | `queued`, `processing`, `completed`, `failed` | e.g. downloading, seeding, cached, queued (TorBox-side) |
| **Live on each poll?** | No — reads last state written by TBM's upload processor | Yes — reflects current TorBox state |
| **When to use** | Wait until TBM has finished calling TorBox `createtorrent` | After `status === "completed"`, track the actual torrent |

`GET /api/v1/uploads/:id` **does not** call TorBox. It returns **TorBox Manager's internal queue status** only. A `completed` upload means TBM successfully submitted the torrent to TorBox and stored `hash`, `torrent_id`, and `auth_id` — not that the download has finished on TorBox.

To monitor download progress, cache state, errors, or presence in TorBox's queued list, call the **TorBox API directly** with the same API key, using the ids from a completed upload (for example `torrent_id` with `GET https://api.torbox.app/v1/api/torrents/mylist`, or TorBox's queued endpoints if you used `as_queued`). See [TorBox API documentation](https://torbox.app/api) for authoritative field names and status values.

## Authentication

Send the user's TorBox API key using either header (Bearer is checked first):

```http
Authorization: Bearer YOUR_TORBOX_API_KEY
```

```http
x-api-key: YOUR_TORBOX_API_KEY
```

Missing key → `401` with `{ "success": false, "error": "API key is required" }`.

## Response envelope

Success responses mirror TorBox-style fields:

```json
{
  "success": true,
  "error": null,
  "detail": "Torrent Queued Successfully",
  "data": {
    "upload_id": 42,
    "status": "queued",
    "queue_order": 0,
    "hash": null,
    "torrent_id": null,
    "auth_id": null
  }
}
```

| Field | When present | Description |
|-------|----------------|-------------|
| `upload_id` | always | TBM local queue row id (poll via GET upload status) |
| `status` | always | **TBM internal queue status** — `queued` \| `processing` \| `completed` \| `failed`. Not TorBox download/cache status. |
| `queue_order` | always | Position in TBM queue (`null` if not queued) |
| `hash` | `status === "completed"` | TorBox infohash returned by createtorrent (use for TorBox API lookups) |
| `torrent_id` | `status === "completed"` | TorBox torrent id (use for TorBox API lookups) |
| `auth_id` | `status === "completed"` | TorBox auth id from createtorrent |
| `error_message` | `status === "failed"` | TBM queue/processor failure reason (not a live TorBox API error) |

`detail` strings: `Torrent Queued Successfully`, `Torrent Created Successfully`, `Torrent Upload Failed`.

Errors: `{ "success": false, "error": "message", "detail"?: "..." }`.

## Upload lifecycle

```text
POST createtorrent/batch  →  TBM status=queued  →  backend processor  →  TorBox createtorrent
                                      ↓
                            GET /api/v1/uploads/:id (poll TBM queue only)
                                      ↓
                         completed (hash, torrent_id, auth_id) | failed (error_message)
                                      ↓
              TorBox API separately (mylist / getqueued) for real torrent status
```

Poll TBM until `completed` or `failed`. Poll interval: your choice; TBM processes uploads every ~5s (`UPLOAD_PROCESSOR_INTERVAL_MS`). After `completed`, use `torrent_id` / `hash` against TorBox for ongoing download state.

---

## POST `/api/v1/torrents/createtorrent`

TorBox-shaped single torrent enqueue. **File or magnet only** (no `link`).

**Content-Type:** `multipart/form-data`

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `file` | one of `file` \| `magnet` | file | `.torrent` file |
| `magnet` | one of `file` \| `magnet` | string | magnet URI |
| `name` | no | string | display name (defaults to filename) |
| `seed` | no | int | seeding ratio hint |
| `allow_zip` | no | bool-ish | `true`/`1`/`"true"`; omitted → backend default `true` |
| `as_queued` | no | bool-ish | add to TorBox queued list when processed |
| `add_only_if_cached` | no | bool-ish | TorBox `add_only_if_cached`; only sent when true |

Validation:

- Exactly one of `file` or `magnet` (not both, not neither).
- `link` field is rejected (`400`).

**Example (magnet):**

```bash
curl -sS -X POST "$BASE/api/v1/torrents/createtorrent" \
  -H "Authorization: Bearer $TORBOX_API_KEY" \
  -F "magnet=magnet:?xt=urn:btih:..." \
  -F "allow_zip=true"
```

**Example (file):**

```bash
curl -sS -X POST "$BASE/api/v1/torrents/createtorrent" \
  -H "x-api-key: $TORBOX_API_KEY" \
  -F "file=@/path/to/file.torrent"
```

---

## POST `/api/v1/torrents/batch`

Batch enqueue (up to **1000** items). **JSON body.**

**Content-Type:** `application/json`

```json
{
  "uploads": [
    {
      "type": "torrent",
      "upload_type": "magnet",
      "url": "magnet:?xt=urn:btih:...",
      "name": "Example",
      "allow_zip": true,
      "as_queued": false,
      "add_only_if_cached": false
    },
    {
      "type": "torrent",
      "upload_type": "file",
      "file_data": "<base64>",
      "filename": "file.torrent",
      "name": "From file"
    }
  ]
}
```

| `upload_type` | Required fields |
|---------------|-----------------|
| `magnet` | `url` (magnet), `name` |
| `link` | `url`, `name` (supported in batch; not on createtorrent) |
| `file` | `file_data` (base64), `filename`, `name` |

Rules:

- Every item must have `"type": "torrent"`.
- `uploads` must be a non-empty array, max 1000.
- File staging failures are returned in `data.errors`; successful items still queue.

**Response:**

```json
{
  "success": true,
  "error": null,
  "detail": "Torrents Queued Successfully",
  "data": {
    "uploads": [
      {
        "upload_id": 1,
        "status": "queued",
        "queue_order": 0,
        "hash": null,
        "torrent_id": null,
        "auth_id": null
      }
    ],
    "errors": []
  },
  "meta": { "total": 1, "successful": 1, "failed": 0 }
}
```

---

## GET `/api/v1/uploads/:id`

Poll **TBM internal queue status** for a single upload.

This endpoint proxies to the self-hosted backend (`GET /api/uploads/:id`), which reads the local `uploads` table. **It does not contact `api.torbox.app`.** The `status` field reflects where the item is in TBM's queue pipeline, not whether TorBox is still downloading, cached, or errored.

**Example:**

```bash
curl -sS "$BASE/api/v1/uploads/42" \
  -H "Authorization: Bearer $TORBOX_API_KEY"
```

Returns the same envelope as createtorrent. Use `upload_id` from POST responses.

`404` if upload id does not exist for the authenticated user.

**After `status === "completed"`**, use `data.torrent_id` and/or `data.hash` to query TorBox directly, for example:

```bash
# TorBox torrent list / status (not a TBM route)
curl -sS "https://api.torbox.app/v1/api/torrents/mylist?id=${TORRENT_ID}" \
  -H "Authorization: Bearer $TORBOX_API_KEY"
```

If the upload was created with `as_queued: true`, the torrent may appear in TorBox's queued list instead of `mylist` until TorBox promotes it — consult TorBox API docs for `getqueued` and related endpoints.

---

## Related internal routes (UI / same backend)

| Route | Purpose |
|-------|---------|
| `POST /api/torrents` | App UI upload (multipart; supports `link`; internal response shape) |
| `POST /api/uploads/batch` | Raw backend proxy (full upload objects, all types) |
| `GET /api/uploads` | List/filter uploads (internal) |

Prefer **v1** routes for TorBox-compatible integrations.

---

## Agent checklist

1. Confirm backend is enabled (`BACKEND_DISABLED` not true).
2. `POST` createtorrent or batch → save `data.upload_id`(s).
3. Poll `GET /api/v1/uploads/:id` until TBM `status` is `completed` or `failed` (this is queue status, not TorBox download status).
4. On `completed`, read `hash`, `torrent_id`, `auth_id` from `data`.
5. On `failed`, read `data.error_message` (TBM processor/queue failure).
6. Do not call TorBox `createtorrent` directly if using this queue — the backend processor owns that call.
7. For live TorBox torrent state (progress, cache, errors), call TorBox API separately using `torrent_id` / `hash` — do not infer it from TBM `status` after step 3.

## Common errors

| HTTP | `error` | Cause |
|------|---------|-------|
| 401 | API key is required | Missing/invalid auth header |
| 400 | multipart/form-data body is required | createtorrent without multipart |
| 400 | Exactly one of file or magnet is required | createtorrent validation |
| 400 | link is not supported on this endpoint | createtorrent with `link` |
| 503 | backend disabled message | `BACKEND_DISABLED=true` |
| 404 | Upload not found | unknown `upload_id` |
