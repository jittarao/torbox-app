# Desktop signing checklist

Complete these steps before enabling signed releases and the auto-updater in production.

## macOS (Apple Developer ID + notarization)

1. Enroll in the Apple Developer Program.
2. Create a **Developer ID Application** certificate.
3. Export the certificate as `.p12` for CI.
4. Generate an app-specific password for notarization.
5. Add GitHub Actions secrets:
   - `APPLE_CERTIFICATE` (base64 `.p12`)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`
6. Update `desktop-release.yml` signing steps (commented placeholders).
7. Generate updater signing keypair:

   ```bash
   bunx tauri signer generate -w ~/.tauri/torbox-manager.key
   ```

8. Set `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
9. Set `bundle.createUpdaterArtifacts: true` in `src-tauri/tauri.conf.json`.
10. Set `plugins.updater.active: true` for release builds.
11. Add `TAURI_SIGNING_PRIVATE_KEY` (and optional password) to GitHub Actions secrets.
12. Notarize and staple the `.dmg` / `.app` before publishing.

## Windows (Authenticode)

1. Obtain an Authenticode code-signing certificate (EV recommended for SmartScreen reputation).
2. Export as `.pfx` for CI.
3. Add GitHub Actions secrets:
   - `WINDOWS_CERTIFICATE` (base64 `.pfx`)
   - `WINDOWS_CERTIFICATE_PASSWORD`
4. Enable signtool step in `desktop-release.yml`.
5. Sign `-setup.exe` and `.nsis.zip` artifacts before upload.
6. Use the same Tauri updater minisign key as macOS.

## Post-signing validation

- [ ] macOS `.app` opens without Gatekeeper block after notarization
- [ ] Windows installer passes SmartScreen on a clean VM
- [ ] `latest.json` signatures verify
- [ ] In-app **Check for updates** finds and installs a test release
- [ ] `TAURI_UPDATER_ACTIVE=true` only on signed release channel builds

## References

- [Tauri updater](https://v2.tauri.app/plugin/updater/)
- [Tauri macOS code signing](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/)
