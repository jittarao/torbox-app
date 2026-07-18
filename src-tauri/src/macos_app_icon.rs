//! macOS uses a generic executable Dock tile when the process is not launched from a
//! bundled `.app`, or after activation-policy changes. Re-apply the app icon explicitly.

#[cfg(target_os = "macos")]
pub fn apply_dock_icon() {
    use objc2::MainThreadMarker;
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    const ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };

    let app = NSApplication::sharedApplication(mtm);
    let data = NSData::with_bytes(ICON_PNG);
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else {
        return;
    };

    unsafe {
        app.setApplicationIconImage(Some(&image));
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_dock_icon() {}
