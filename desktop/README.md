# TorBox Manager Desktop

Native macOS and Windows desktop shell for TorBox Manager using [Tauri v2](https://v2.tauri.app/). The app loads the hosted web UI in a WebView and exposes a small, capability-gated IPC bridge for secure credentials, folder watching, tray background operation, and native notifications.

## Architecture

- **UI**: Remote WebView → default `https://tbm.tools` (or a custom self-hosted HTTPS URL)
- **No bundled Next.js** and **no local backend sidecar**
- **Rust IPC**: handshake, instance URL, credentials, folder watcher, tray, notifications, launch at login, updater (staging)
- **Web bridge**: `src/desktop/*` with browser-safe fallbacks

## Prerequisites

### All platforms

- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/) (repo package manager)

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- For distribution: Apple Developer ID + notarization credentials (see [`desktop/release/signing-checklist.md`](release/signing-checklist.md))

### Windows

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (usually preinstalled on Windows 10/11)
- For distribution: Authenticode signing certificate (see signing checklist)

## Development

Terminal 1 — Next.js frontend:

```bash
bun run dev
```

Terminal 2 — Tauri shell (loads `http://localhost:3000` in dev):

```bash
bun run desktop:dev
```

Debug builds register runtime IPC capabilities for `localhost:3000`. Production builds load `https://tbm.tools` by default and honor a persisted custom HTTPS instance URL after restart.

Set `TAURI_UPDATER_ACTIVE=true` to exercise updater commands in debug builds.

## Build

```bash
# Release installers (macOS .dmg, Windows NSIS .exe)
bun run desktop:build

# Debug build
bun run desktop:build:debug
```

Artifacts are written under `src-tauri/target/release/bundle/`.

Release pipeline details: [`desktop/release/README.md`](release/README.md)

### Icons

Source: [src-tauri/icons/icon-source.png](../src-tauri/icons/icon-source.png) (1024×1024).

```bash
bun run desktop:icon
```

## Instance URL

| Mode        | URL                                                            |
| ----------- | -------------------------------------------------------------- |
| Default     | `https://tbm.tools`                                            |
| Self-hosted | User-configured `https://host` via **Settings** in the sidebar |
| Dev         | `http://localhost:3000` (`tauri dev` only)                     |

Custom URLs must be HTTPS origins without paths, credentials, or query strings. Changing the instance URL requires an **app restart**.

## IPC commands

| Command                                                                              | Purpose                              |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| `desktop_hello`                                                                      | Handshake + capability manifest      |
| `get_instance_url` / `set_instance_url`                                              | Custom HTTPS origin                  |
| `sync_api_key_to_desktop` / `get_credential_status` / `clear_desktop_credential`     | API key in `desktop-settings.json`   |
| `pick_folder` / `pick_move_destination_folder`                                       | Native folder pickers                |
| `get/set/start/stop/get_folder_watcher_status`                                       | Folder watcher                       |
| `get_launch_at_login` / `set_launch_at_login`                                        | Launch at login                      |
| `get_tray_settings` / `set_tray_settings`                                            | Close/minimize/start-hidden behavior |
| `get_notification_settings` / `set_notification_settings` / `show_test_notification` | Native notifications                 |
| `check_for_update_command` / `install_update_command`                                | Auto-updater (staging)               |

Tauri events: `desktop://watcher-status-changed`, `desktop://torrent-detected`, `desktop://upload-queued`, `desktop://upload-succeeded`, `desktop://upload-failed`, `desktop://capabilities-changed`, `desktop://tray-open-settings`, `desktop://update-available`, `desktop://update-progress`.

## Torrent folder watcher

See Phase 5 docs in the original migration plan. Watcher auto-resumes on launch when enabled and a credential is stored.

Detected `.torrent` files are **coalesced into batches** (~1.5s idle after the last file event, up to 1000 per request) and uploaded via `POST /api/uploads/batch`. Native notifications summarize each batch (e.g. “5 torrents were uploaded successfully”) instead of one notification per file. Per-file Tauri events and the activity log are unchanged.

## Tray and background operation

- **Close to tray** — closing the window hides it; use the tray icon or **Open** menu item to restore
- **Minimize to tray** — minimizing hides the window (Windows/Linux)
- **Start hidden** — with launch at login, boots to tray only
- **Quit** — tray menu exits and stops the watcher

## Launch at login

Configured under **Settings → General**. macOS bundled builds use `SMAppService`; dev builds use a Launch Agent wrapper. If macOS reports **Requires approval**, allow TorBox Manager in **System Settings → General → Login Items**.

## Native notifications

Configured under **Settings → Background**. Upload success/failure notifications are emitted from Rust when the folder watcher runs, even if the window is hidden.

## Compatibility matrix

| Scenario              | Expected behavior                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Old desktop + new web | Missing capabilities hide tray/notification/updater UI; watcher still works if supported |
| New desktop + old web | Site loads; desktop settings nav hidden until web bridge is deployed                     |
| Custom instance URL   | Runtime capability registration + `desktop://capabilities-changed`                       |
| Browser               | No desktop settings; bridge methods no-op                                                |

Deploy hosted `src/desktop/*` changes **before** shipping desktop builds that depend on new capabilities.

## Linux support

Linux builds are **best-effort** and not part of the MVP release gate.

| Feature       | Notes                                            |
| ------------- | ------------------------------------------------ |
| Tray          | Depends on desktop environment (GNOME/KDE/etc.)  |
| Notifications | Requires freedesktop notification portal         |
| Autostart     | XDG autostart entry via `tauri-plugin-autostart` |
| Credentials   | Stored in `desktop-settings.json` app data       |

Use Windows or macOS for production validation.

## Manual QA checklist

### Core

- [ ] `bun run desktop:dev` opens `localhost:3000` with the Next.js dev server running
- [ ] Release build opens `https://tbm.tools` on first launch
- [ ] **Settings** page shows version, platform, and protocol
- [ ] Normal browser session shows no Desktop panel and no console errors
- [ ] `bun test src/desktop/__tests__` passes
- [ ] `cd src-tauri && cargo test` passes

### Credentials and watcher

- [ ] **Enable background features** stores credential; status shows `hasApiKey: true`
- [ ] Folder watcher uploads a dropped `.torrent` file
- [ ] Watcher auto-resumes after app restart when enabled

### Tray and notifications

- [ ] Tray icon visible; **Open** restores the window
- [ ] Close with **Close to tray** enabled hides instead of exiting
- [ ] **Quit** from tray exits and stops the watcher
- [ ] Launch at login + **Start hidden** boots to tray without window flash
- [ ] Upload success/failure shows a native notification when enabled
- [ ] **Send test notification** works

### Launch at login

- [ ] Toggle persists across restarts
- [ ] Reboot/sign-in test on Windows and macOS
- [ ] macOS **Requires approval** message appears when applicable

### Updater (staging)

- [ ] With `TAURI_UPDATER_ACTIVE=true`, **Check for updates** runs without error
- [ ] Unsigned release builds show updater as unavailable in production channel

### Windows VM (clean install)

- [ ] Unsigned installer shows SmartScreen warning (expected until signing)
- [ ] WebView2 bootstrap succeeds
- [ ] Tray + watcher + notifications end-to-end

### macOS bundled `.app`

- [ ] Gatekeeper warning for unsigned builds (expected until notarization)
- [ ] Login item + Requires approval flow
- [ ] Folder picker + watcher on a user-selected directory

## Security notes

- Remote IPC is restricted by Tauri capability URL patterns
- Sensitive commands validate the WebView origin against the stored instance URL
- Only explicit user action syncs the API key into `desktop-settings.json`
- Notification commands do not accept arbitrary title/body from the web page
- Production CSP headers are set in `next.config.mjs`; residual `unsafe-inline` / `unsafe-eval` remain for Next.js runtime needs
- XSS on the hosted origin could invoke allowed desktop commands — keep the IPC surface narrow

## Related docs

- [prompts/tauri-migration.md](../prompts/tauri-migration.md) — phased roadmap
- [desktop/release/README.md](release/README.md) — CI and updater
- [desktop/release/signing-checklist.md](release/signing-checklist.md) — signing when ready
- [Tauri v2 capabilities](https://v2.tauri.app/security/capabilities/)
