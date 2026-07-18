/// macOS shows the Cargo binary name in the Dock and app menu during `tauri dev`
/// when the process is not launched from a `.app` bundle. Set the process display
/// name before Tauri initializes so Dock/About use the human-readable product name.
#[cfg(target_os = "macos")]
pub fn apply_process_display_name(name: &str) {
    use std::ffi::CString;
    use std::os::raw::c_char;

    extern "C" {
        fn setprogname(name: *const c_char);
    }

    if let Ok(name) = CString::new(name) {
        unsafe {
            setprogname(name.as_ptr());
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_process_display_name(_name: &str) {}
