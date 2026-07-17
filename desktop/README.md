# TorBox Manager Desktop

Native macOS and Windows desktop shell for TorBox Manager using [Tauri v2](https://v2.tauri.app/). The app loads the hosted web UI in a WebView and exposes a small, capability-gated IPC bridge for secure credentials and future native features.

## Architecture

- **UI**: Remote WebView → default `https://tbm.tools` (or a custom self-hosted HTTPS URL)
- **No bundled Next.js** and **no local backend sidecar** in MVP
- **Rust IPC**: `desktop_hello`, instance URL settings, secure API key storage, torrent folder watcher
- **Web bridge**: `src/desktop/*` with browser-safe fallbacks

## Prerequisites

### All platforms

- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/) (repo package manager)

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- For distribution: Apple Developer ID + notarization credentials (post-MVP)

### Windows

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (usually preinstalled on Windows 10/11)
- For distribution: Authenticode signing certificate (post-MVP)

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

## Build

```bash
# Release installers (macOS .dmg/.app, Windows .msi/.exe)
bun run desktop:build

# Debug build
bun run desktop:build:debug
```

Artifacts are written under `src-tauri/target/release/bundle/`.

### Icons

Source: [src-tauri/icons/icon-source.png](../src-tauri/icons/icon-source.png) (1024×1024, artwork inset to Apple's macOS safe zone).

Regenerate platform bundle icons after changing the source:

```bash
bun run desktop:icon
```

This only updates `src-tauri/icons/` — web/PWA icons under `public/icons/` are separate.

## Instance URL

| Mode        | URL                                                            |
| ----------- | -------------------------------------------------------------- |
| Default     | `https://tbm.tools`                                            |
| Self-hosted | User-configured `https://host` via **Settings** in the sidebar |
| Dev         | `http://localhost:3000` (`tauri dev` only)                     |

Custom URLs must be HTTPS origins without paths, credentials, or query strings. Changing the instance URL requires an **app restart** in MVP.

## IPC commands (MVP)

| Command                        | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `desktop_hello`                | Handshake + capability manifest                        |
| `get_instance_url`             | Read persisted instance URL                            |
| `set_instance_url`             | Validate and persist custom HTTPS origin               |
| `sync_api_key_to_desktop`      | Store TorBox API key in OS keychain (consent required) |
| `get_credential_status`        | Metadata only — never returns the raw key              |
| `clear_desktop_credential`     | Remove stored key                                      |
| `pick_folder`                  | Native folder picker for watch directory (allowlisted) |
| `pick_move_destination_folder` | Native folder picker for post-upload move target       |
| `get_folder_watcher_config`    | Read folder watcher settings                           |
| `set_folder_watcher_config`    | Save settings and restart watcher if enabled           |
| `start_folder_watcher`         | Start watching (optional `scanExisting`)               |
| `stop_folder_watcher`          | Stop watching                                          |
| `get_folder_watcher_status`    | Queue depth, activity log, last error                  |
| `get_launch_at_login`          | Read launch-at-login preference and OS state           |
| `set_launch_at_login`          | Enable or disable launch at login                      |

## Torrent folder watcher

qBittorrent-style background watching for `.torrent` files:

1. Open **Settings** in the sidebar (desktop shell only).
2. **Enable background features** to store your TorBox API key in the OS keychain.
3. Configure **Torrent folder watcher**: choose a watch folder, post-upload action, and torrent options.
4. Enable or start the watcher.

The Rust layer watches the selected folder (non-recursive), waits until each file is stable, uploads via `POST {instanceUrl}/api/uploads/batch` using the stored API key, then deletes or moves the `.torrent` file based on your setting:

- **Delete** — remove the file after a successful upload
- **Move to uploaded/** — move into `{watchFolder}/uploaded/`
- **Move to custom folder** — move into a separately chosen directory

**Requirements:**

- Backend must be enabled on the target TorBox Manager instance (`BACKEND_DISABLED` blocks uploads).
- Watch and move destinations must be chosen through the native folder picker (paths are allowlisted in `desktop-settings.json`).
- Optional **Scan existing files** uploads `.torrent` files already in the folder when the watcher starts (confirmation required in the UI).

Watcher state persists across app restarts. If the watcher was enabled and a credential is stored, it auto-starts on launch.

Tauri events (for live UI updates): `desktop://watcher-status-changed`, `desktop://torrent-detected`, `desktop://upload-queued`, `desktop://upload-succeeded`, `desktop://upload-failed`.

## Launch at login

Launch at login ships early (Phase 6 scope) so background folder watching can resume after sign-in without manual app launch.

In **Settings → General**, enable **Open TorBox Manager at login** to register the app with the OS autostart service (macOS Launch Agent, Windows Run key, Linux autostart entry). The preference is stored in `desktop-settings.json` and synced on each app launch.

## Manual QA checklist

- [ ] `bun run desktop:dev` opens `localhost:3000` with the Next.js dev server running
- [ ] Release build opens `https://tbm.tools` on first launch
- [ ] **Settings** page shows version, platform, and protocol
- [ ] Saving a valid custom `https://` instance URL persists across restarts
- [ ] Invalid URLs (`http://`, paths, credentials) are rejected
- [ ] **Enable background features** stores credential; status shows `hasApiKey: true`
- [ ] **Clear secure credential** removes keychain entry
- [ ] Normal browser session shows no Desktop panel and no console errors
- [ ] `bun test src/desktop/__tests__` passes
- [ ] `cd src-tauri && cargo test` passes (URL validation, watcher paths)
- [ ] Folder watcher: pick folder, enable watcher, drop a `.torrent` file, verify upload in **Uploads**
- [ ] Post-upload move/delete behaves per selected action
- [ ] Watcher auto-resumes after app restart when enabled
- [ ] Launch at login toggle persists across app restarts
- [ ] Launch at login: enable, sign out/in (or reboot), verify app starts
- [ ] Change watch folder while watcher is running: confirm modal stops watcher, saves disabled state, and persists new folder
- [ ] Desktop bridge init failure shows retry UI instead of infinite spinner
- [ ] Upload succeeds but move/delete fails: torrent is not re-uploaded on next watch event

## Security notes

- Remote IPC is restricted by Tauri capability URL patterns (`https://tbm.tools` in production; custom self-hosted origins are registered at runtime from saved settings)
- Debug builds additionally allow `http://localhost:3000` IPC via runtime capabilities (not shipped in release builds)
- Sensitive commands validate the WebView origin against the stored instance URL
- Only explicit user action syncs the API key to the OS credential store
- Keep the hosted site CSP tight — XSS on the loaded origin could invoke allowed desktop commands

## Signing and release (post-MVP)

MVP builds are unsigned local artifacts. Phase 7 adds:

- GitHub Actions matrix (`macos-latest`, `windows-latest`)
- Apple Developer ID + notarization
- Windows Authenticode signing
- Tauri auto-updater configuration

## Related docs

- Deploy the hosted web bridge (`src/desktop/*`) to production **before** shipping desktop builds that depend on `desktop_hello`.
- [prompts/tauri-migration.md](../prompts/tauri-migration.md) — full phased roadmap
- [Tauri v2 capabilities](https://v2.tauri.app/security/capabilities/)
