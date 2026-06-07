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
| `upload_id` | always | Local queue row id (poll via GET upload status) |
| `status` | always | `queued` \| `processing` \| `completed` \| `failed` |
| `queue_order` | always | Position in queue (`null` if not queued) |
| `hash` | `status === "completed"` | TorBox infohash from createtorrent |
| `torrent_id` | `status === "completed"` | TorBox torrent id |
| `auth_id` | `status === "completed"` | TorBox auth id from createtorrent |
| `error_message` | `status === "failed"` | Failure reason |

`detail` strings: `Torrent Queued Successfully`, `Torrent Created Successfully`, `Torrent Upload Failed`.

Errors: `{ "success": false, "error": "message", "detail"?: "..." }`.

## Upload lifecycle

```text
POST createtorrent/batch  →  status=queued  →  backend processor  →  TorBox createtorrent
                                      ↓
                            GET /api/v1/uploads/:id (poll)
                                      ↓
                         completed (hash, torrent_id, auth_id) | failed (error_message)
```

Poll interval: agent's choice; uploads are processed every ~5s (`UPLOAD_PROCESSOR_INTERVAL_MS`).

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

Poll queue status for a single upload.

**Example:**

```bash
curl -sS "$BASE/api/v1/uploads/42" \
  -H "Authorization: Bearer $TORBOX_API_KEY"
```

Returns the same envelope as createtorrent. Use `upload_id` from POST responses.

`404` if upload id does not exist for the authenticated user.

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
3. Poll `GET /api/v1/uploads/:id` until `status` is `completed` or `failed`.
4. On `completed`, read `hash`, `torrent_id`, `auth_id` from `data`.
5. On `failed`, read `data.error_message`.
6. Do not call TorBox `createtorrent` directly if using this queue — the backend processor owns that call.

## Common errors

| HTTP | `error` | Cause |
|------|---------|-------|
| 401 | API key is required | Missing/invalid auth header |
| 400 | multipart/form-data body is required | createtorrent without multipart |
| 400 | Exactly one of file or magnet is required | createtorrent validation |
| 400 | link is not supported on this endpoint | createtorrent with `link` |
| 503 | backend disabled message | `BACKEND_DISABLED=true` |
| 404 | Upload not found | unknown `upload_id` |
