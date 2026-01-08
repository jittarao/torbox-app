You are a senior full-stack engineer working on **TorBox Manager (TBM)**, a Next.js + optional Express backend application.

Your task is to **implement a robust torrent automation engine** that works **without any new TorBox API support**, using **polling + derived state**, and using a **SQLite-per-user database architecture**.

---

## Critical architectural constraint (must follow)

### 🔒 SQLite-per-user model (MANDATORY)

* Each TorBox API key / user gets **its own SQLite database file**
* Databases live under a common directory, e.g.:

```text
/app/data/users/
  user_<auth_id>.sqlite
```

* Never share a SQLite DB across users
* Never keep more than a **small bounded number of DB connections open**
* Open DB → work → close DB (or LRU pool ≤ 50)

This is non-negotiable.

---

## Context

* TorBox’s torrent API returns **snapshot-style torrent JSON objects** (no events, no timestamps like `last_activity_at`)
* You must **derive missing fields client-side** by polling and diffing
* TBM already includes:

  * Optional self-hosted backend
  * SQLite
  * `node-cron`
  * `backend/src/automation/`
* Automations must work **24×7** when backend is enabled

---

## Core implementation requirements

---

### 1. Per-user poller & scheduler

* Create a scheduler that:

  * Iterates over **active users**
  * Polls TorBox torrent list API every **N minutes** (default 5)
  * Runs **independently per user**
* Polling must be:

  * Rate-limited
  * Skipped if previous run is still executing
  * Resilient to API failures (fail closed)

---

### 2. Per-user shadow torrent state (SQLite)

Each user DB must persist a **shadow state** per torrent:

```ts
torrent_shadow {
  torrent_id
  hash
  name
  last_seen_at
  last_total_downloaded
  last_total_uploaded
  last_progress
  last_state
}
```

State is updated only by polling diffs.

---

### 3. Derived torrent fields (computed locally)

Persist these **derived fields** in the user DB:

```ts
last_download_activity_at
last_upload_activity_at
stalled_since
seeding_time_seconds
downloading_time_seconds
```

Rules:

* If `total_downloaded` increases → update `last_download_activity_at`
* If `total_uploaded` increases → update `last_upload_activity_at`
* Detect state transitions between polls to set `*_started_at`
* If downloading AND no download activity for X minutes → set `stalled_since`
* Clear `stalled_since` once activity resumes
* Increment seeding/downloading time by poll interval when applicable

Accuracy within ±poll interval is acceptable.

---

### 4. Rolling speed aggregates (no raw samples)

Per user DB should maintain rolling aggregates:

```ts
avg_download_speed_5m
avg_download_speed_1h
avg_upload_speed_5m
avg_upload_speed_1h
max_download_speed
```

Implementation guidance:

* Store a bounded circular buffer of `(timestamp, total_downloaded, total_uploaded)`
* Compute deltas over time windows
* Do NOT store per-second samples
* Prune aggressively

---

### 5. Synthetic event system (per user)

Emit and persist synthetic events:

```ts
TORRENT_DOWNLOADING_STARTED
TORRENT_SEEDING_STARTED
TORRENT_STALLED
TORRENT_RATIO_REACHED
TORRENT_COMPLETED
```

Events must:

* Be generated from diffs
* Be written to the **user’s SQLite DB**
* Support audit/debug (“why did this rule fire?”)

---

### 6. Automation rule engine (per user)

Rules live **inside the user’s DB**.

Rule model example:

```ts
Rule {
  id
  enabled
  name
  trigger
  conditions[]
  actions
}
```

Conditions support:

* Numeric comparisons (`> < >= <= ==`)
* Time-based checks (`stalled_for > X`)
* String matching (torrent name regex)
* Derived fields (ratio, seeding_time, speeds, availability)

Actions:

* pause torrent
* stop seeding
* delete torrent (torrent only, never files by default)
* archive torrent (store torrent file or magent link in db)

Rules must:

* Be idempotent
* Respect cooldowns
* Log execution results

---

### 7. Safety & operational guarantees

* No cross-user DB access
* No long-running write transactions
* WAL mode enabled
* Writes batched per poll
* Hard caps on history size
* Dry-run mode supported
* Fail closed if TorBox API unavailable

---

### 8. Minimal frontend changes only

Frontend should:

* Display automation status per torrent
* Show last automation action tooltip
* Create and edit automation rules
* Allow enable/disable rules

Do NOT redesign UI.

---

### 9. Database lifecycle

* Create user DB on first backend use
* Delete DB when API key is removed
* Auto-vacuum / prune periodically
* DB file is the user’s full automation state

---

## Deliverables

1. SQLite-per-user polling system
2. Derived torrent telemetry
3. Synthetic event pipeline
4. Rule evaluation engine
5. Example default rules:

   * Stop seeding at ratio ≥ 1
   * Stop stalled downloads after 6h
   * Stop seeding after 24h
6. Inline documentation

Design this as a **seedbox-grade automation layer** built on top of a dumb API.

---

## 🔥 High-value automation use-cases

### 1. **Seeding control**

**Rules**

* If `ratio >= X` → stop seeding
* If `seeding_time >= X hours` → stop seeding
* If `upload_speed < X for Y mins` → stop seeding (dead torrent)
* If `seeds >= X` → stop seeding (already healthy swarm)

**Why users want it**

* Avoid pointless long-term seeding
* Save bandwidth / avoid ISP throttling

---

### 2. **Stall & dead torrent handling**

**Rules**

* If `download_speed == 0 for > X hours` → archive torrent
* If `peers == 0 for > X hours` → archive torrent
* If `progress_change < X after Y hours` → archive torrent

**Why**

* Auto-kill hopeless downloads
* Especially important for debrid / remote boxes

---

**Why**

* Turns it into a pipeline, not a UI

---

## 🔑 Additional keys you should track (important)

### ⏱ Time-based (critical)

```json
"last_activity_at"
"last_download_activity_at"
"last_upload_activity_at"
"stalled_since"
```

Without these, stall rules are impossible.

---

### 📊 Counters & durations

```json
"seeding_time_seconds"
"downloading_time_seconds"
"total_active_time_seconds"
"stall_count"
```

Enables smarter “give up after N stalls” logic.

---

### 🚀 Speed history (aggregated, not raw)

```json
"avg_download_speed_5m"
"avg_download_speed_1h"
"avg_upload_speed_5m"
"avg_upload_speed_1h"
"max_download_speed"
```

Don’t store raw samples — store rolling aggregates.

---

### 🌐 Swarm health

```json
"seeders"
"leechers"
```

You already have some — formalize them.

---

