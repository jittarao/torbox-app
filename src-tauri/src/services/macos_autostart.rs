use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::constants::{APP_DISPLAY_NAME, BUNDLE_IDENTIFIER, LEGACY_LAUNCH_AGENT_LABEL};

const LAUNCH_AGENT_LABEL: &str = BUNDLE_IDENTIFIER;
const LSREGISTER_PATH: &str = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

fn launch_agents_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Library/LaunchAgents"))
}

fn launch_agent_plist(label: &str) -> Option<PathBuf> {
    launch_agents_dir().map(|dir| dir.join(format!("{label}.plist")))
}

fn dev_app_bundle_path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| {
        PathBuf::from(home)
            .join("Library/Application Support")
            .join(BUNDLE_IDENTIFIER)
            .join(format!("{APP_DISPLAY_NAME}.app"))
    })
}

fn running_in_app_bundle() -> bool {
    resolve_executable_path()
        .map(|path| path.contains(".app/"))
        .unwrap_or(false)
}

fn resolve_executable_path() -> Result<String, String> {
    let current_exe =
        std::env::current_exe().map_err(|e| format!("Failed to resolve app path: {e}"))?;
    let exe_path = current_exe
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize app path: {e}"))?;
    Ok(exe_path.display().to_string())
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn run_osascript(script: &str) -> Result<(), String> {
    let output = Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| format!("Failed to run AppleScript: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err("AppleScript command failed".into())
    } else {
        Err(format!("AppleScript command failed: {stderr}"))
    }
}

fn delete_login_item(name: &str) {
    let script = format!(
        "tell application \"System Events\" to delete login item \"{}\"",
        escape_applescript_string(name)
    );
    let _ = run_osascript(&script);
}

fn remove_launch_agent_plist(label: &str) {
    if let Some(path) = launch_agent_plist(label) {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
}

pub fn remove_launch_agent_plists() {
    for label in [
        LEGACY_LAUNCH_AGENT_LABEL,
        APP_DISPLAY_NAME,
        LAUNCH_AGENT_LABEL,
    ] {
        remove_launch_agent_plist(label);
    }
}

fn launch_agent_enabled() -> bool {
    launch_agent_plist(LAUNCH_AGENT_LABEL).is_some_and(|path| path.exists())
}

fn legacy_launch_agent_enabled() -> bool {
    [LEGACY_LAUNCH_AGENT_LABEL, APP_DISPLAY_NAME]
        .into_iter()
        .any(|label| launch_agent_plist(label).is_some_and(|path| path.exists()))
}

fn launch_agent_points_at_legacy_launcher() -> bool {
    let Some(path) = launch_agent_plist(LAUNCH_AGENT_LABEL) else {
        return false;
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return false;
    };
    !contents.contains("/usr/bin/open</string>")
        && (contents.contains("/MacOS/launcher</string>")
            || contents.contains("/torbox-manager</string>"))
}

fn smappservice_enabled() -> bool {
    use smappservice_rs::{AppService, ServiceStatus, ServiceType};

    let service = AppService::new(ServiceType::MainApp);
    matches!(
        service.status(),
        ServiceStatus::Enabled | ServiceStatus::RequiresApproval
    )
}

fn disable_smappservice() {
    use smappservice_rs::{AppService, ServiceType};

    let service = AppService::new(ServiceType::MainApp);
    let _ = service.unregister();
}

fn enable_smappservice() -> Result<(), String> {
    use smappservice_rs::{AppService, ServiceType};

    let service = AppService::new(ServiceType::MainApp);
    service
        .register()
        .map_err(|e| format!("Failed to register {APP_DISPLAY_NAME} as a login item: {e}"))
}

fn register_app_bundle(app_path: &Path) -> Result<(), String> {
    if !Path::new(LSREGISTER_PATH).exists() {
        return Ok(());
    }

    let output = Command::new(LSREGISTER_PATH)
        .args(["-f", "-R", &app_path.display().to_string()])
        .output()
        .map_err(|e| format!("Failed to register app bundle with Launch Services: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Failed to register app bundle with Launch Services".into()
        } else {
            format!("Failed to register app bundle with Launch Services: {stderr}")
        })
    }
}

fn write_dev_app_bundle(executable: &str) -> Result<PathBuf, String> {
    let app_path = dev_app_bundle_path().ok_or("Failed to resolve dev app bundle path")?;
    let contents = app_path.join("Contents");
    let macos_dir = contents.join("MacOS");
    let bundle_executable = macos_dir.join(APP_DISPLAY_NAME);
    let legacy_launcher = macos_dir.join("launcher");

    fs::create_dir_all(&macos_dir)
        .map_err(|e| format!("Failed to create dev app bundle directories: {e}"))?;

    if legacy_launcher.exists() {
        let _ = fs::remove_file(legacy_launcher);
    }

    let launcher_script = format!(
        "#!/bin/bash\nexec \"{}\" \"$@\"\n",
        executable.replace('\\', "\\\\").replace('"', "\\\"")
    );
    fs::write(&bundle_executable, launcher_script)
        .map_err(|e| format!("Failed to write dev app executable: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&bundle_executable, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to mark dev app executable: {e}"))?;
    }

    let info_plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>{BUNDLE_IDENTIFIER}</string>
    <key>CFBundleName</key>
    <string>{APP_DISPLAY_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>{APP_DISPLAY_NAME}</string>
    <key>CFBundleExecutable</key>
    <string>{APP_DISPLAY_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
</dict>
</plist>
"#
    );

    fs::write(contents.join("Info.plist"), info_plist)
        .map_err(|e| format!("Failed to write dev app Info.plist: {e}"))?;

    register_app_bundle(&app_path)?;
    Ok(app_path)
}

fn resolve_app_bundle_path() -> Result<String, String> {
    let executable = resolve_executable_path()?;
    if let Some((bundle_path, _)) = executable.split_once(".app/") {
        return Ok(format!("{bundle_path}.app"));
    }

    let app_path = write_dev_app_bundle(&executable)?;
    Ok(app_path.display().to_string())
}

fn launch_agent_program_arguments_xml(app_bundle_path: &str) -> String {
    format!(
        r#"    <string>/usr/bin/open</string>
        <string>-a</string>
        <string>{}</string>"#,
        escape_xml(app_bundle_path)
    )
}

fn enable_launch_agent() -> Result<(), String> {
    let app_bundle_path = resolve_app_bundle_path()?;
    let dir = launch_agents_dir().ok_or("Failed to resolve LaunchAgents directory")?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create LaunchAgents directory: {e}"))?;

    let program_arguments = launch_agent_program_arguments_xml(&app_bundle_path);

    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>AssociatedBundleIdentifiers</key>
    <array>
        <string>{bundle_id}</string>
    </array>
    <key>ProgramArguments</key>
    <array>
{program_arguments}
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
"#,
        label = LAUNCH_AGENT_LABEL,
        bundle_id = BUNDLE_IDENTIFIER,
        program_arguments = program_arguments,
    );

    let path = dir.join(format!("{LAUNCH_AGENT_LABEL}.plist"));
    let mut file =
        fs::File::create(&path).map_err(|e| format!("Failed to create launch agent plist: {e}"))?;
    file.write_all(plist.as_bytes())
        .map_err(|e| format!("Failed to write launch agent plist: {e}"))
}

fn remove_legacy_login_items() {
    for name in [LEGACY_LAUNCH_AGENT_LABEL, APP_DISPLAY_NAME] {
        delete_login_item(name);
    }
}

pub fn migrate_if_needed() -> Result<(), String> {
    remove_legacy_login_items();

    if legacy_launch_agent_enabled() || launch_agent_points_at_legacy_launcher() {
        remove_launch_agent_plists();
        return enable();
    }

    if running_in_app_bundle() && launch_agent_enabled() && !smappservice_enabled() {
        remove_launch_agent_plist(LAUNCH_AGENT_LABEL);
        return enable_smappservice();
    }

    Ok(())
}

pub fn is_enabled() -> Result<bool, String> {
    if running_in_app_bundle() {
        return Ok(smappservice_enabled() || launch_agent_enabled());
    }

    Ok(launch_agent_enabled() || legacy_launch_agent_enabled())
}

pub fn enable() -> Result<(), String> {
    remove_legacy_login_items();

    if legacy_launch_agent_enabled() {
        remove_launch_agent_plists();
    }

    if running_in_app_bundle() {
        if launch_agent_enabled() {
            remove_launch_agent_plist(LAUNCH_AGENT_LABEL);
        }
        if smappservice_enabled() {
            return Ok(());
        }
        return enable_smappservice();
    }

    if launch_agent_points_at_legacy_launcher() {
        remove_launch_agent_plist(LAUNCH_AGENT_LABEL);
    }

    enable_launch_agent()
}

pub fn disable() -> Result<(), String> {
    disable_smappservice();
    remove_launch_agent_plists();
    remove_legacy_login_items();
    Ok(())
}
