# Desktop release pipeline

GitHub Actions builds installers and publishes a GitHub Release automatically when you push a desktop version tag. You do **not** commit binaries to the repo.

## What users download

One installer per platform is enough:

| Platform | User installer         | Notes                                                                                           |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| macOS    | `.dmg` only            | The `.app` bundle is created internally and packaged inside the DMG — not published separately. |
| Windows  | NSIS `-setup.exe` only | MSI is not built. NSIS matches the Tauri updater format (`.nsis.zip`).                          |

Separate **updater bundles** (`.app.tar.gz`, `.nsis.zip`) are attached to the release for in-app updates once signing is enabled. They are not what new users download.

Bundle targets are set in `src-tauri/tauri.conf.json` → `bundle.targets: ["dmg", "nsis"]`.

## Versioning (web vs desktop)

TorBox Manager uses **two independent semver tracks**:

| Track       | Files                                               | When to bump                                                                |
| ----------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| **Web**     | `package.json`, `backend/package.json`              | Hosted deploys (UI, API routes, backend). Drives `User-Agent` and About UI. |
| **Desktop** | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` | New installers only (Rust IPC, tray, updater, native fixes).                |

The desktop app loads the hosted UI from `https://tbm.tools`, so most releases are **web-only** — users get new UI on refresh without reinstalling.

```bash
bun run version:show
bun run version:desktop:patch    # before tagging a desktop release
```

Tag desktop releases with the **desktop** version: `v0.1.6` must match `src-tauri/tauri.conf.json`.

## Automated release (recommended)

```bash
bun run version:desktop:patch
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore(desktop): release 0.1.6"
git push origin main
git tag v0.1.6
git push origin v0.1.6
```

Push the commit first, then create and push the tag. The tag must point at a commit that already includes the version bump.

On tag push, `.github/workflows/desktop-release.yml`:

1. Builds on `macos-latest` and `windows-latest` in parallel
2. Verifies the tag matches `src-tauri/tauri.conf.json` version
3. Publishes a GitHub Release with:
   - macOS `.dmg`
   - Windows `-setup.exe`
   - `latest.json` (only when signed updater artifacts exist)

CI build jobs skip `bun install` (the shell loads the hosted UI, not a bundled Next.js app) and use `npx @tauri-apps/cli` plus Rust/sccache caching with faster release profile overrides. Local `bun run desktop:build` still uses the size-optimized `[profile.release]` in `src-tauri/Cargo.toml`.

`workflow_dispatch` still builds and uploads CI artifacts for testing, but **does not** create a GitHub Release (releases require a tag).

### Retag after a failed release

If CI failed on a tag but you fixed the issue on a newer commit, move the tag instead of creating a new one. Git refuses `git tag v0.1.0` when that name already exists.

```bash
# After fixes are committed and pushed to main
git tag -f v0.1.0 HEAD
git push origin v0.1.0 --force
```

This re-triggers `desktop-release.yml` from the updated commit. `softprops/action-gh-release` updates the existing GitHub Release when the tag is force-pushed.

**Only retag** when no users have downloaded that version yet. If the broken release may already be installed, bump the desktop patch version and tag a new release instead (`bun run version:desktop:patch` → new `v0.1.1`).

## Local build (optional)

For debugging before tagging:

```bash
bun run desktop:build
```

Outputs:

- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/nsis/*-setup.exe`

## Updater (staging)

The Tauri updater plugin is wired but **disabled in release builds** until signing is configured.

| Variable                    | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `TAURI_UPDATER_ACTIVE=true` | Enables updater commands and capability in dev/staging builds |

Manifest generator: `bun scripts/generate-desktop-latest-json.js <assets-dir>`

Template reference: [`latest.json.template`](./latest.json.template)

Production endpoint (when enabled): `https://github.com/jittarao/torbox-app/releases/latest/download/latest.json`

## Signing (deferred)

See [`signing-checklist.md`](./signing-checklist.md) for Apple and Windows credential setup.

Until Apple Developer ID signing + notarization is enabled:

- `bundle.macOS.signingIdentity` is `"-"` (ad-hoc) so CI-built `.app` bundles are sealed and no longer show macOS’s misleading **“is damaged”** dialog on Apple Silicon
- Users still need **right-click → Open** (or **Privacy & Security → Open Anyway**) the first time; double-click remains blocked without a Developer ID cert
- `bundle.createUpdaterArtifacts` is `false` (no updater `.sig` / zip bundles)
- Windows SmartScreen may warn on unsigned `-setup.exe`
- Auto-update install is disabled (`tauri.conf.json` → `plugins.updater.active: false`)
- `latest.json` is skipped on release (no valid signatures)

## Deploy order

1. Deploy hosted web bridge (`src/desktop/*`) and UI to production.
2. When native capabilities change: `version:desktop:patch` → commit → push main → `git tag v{desktop}` → `git push origin v{desktop}`.
3. Enable signing + updater when credentials are ready.
