mod commands;
mod constants;
mod macos_display_name;
mod menu;
mod services;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    macos_display_name::apply_process_display_name(constants::APP_DISPLAY_NAME);

    tauri::Builder::default()
        .menu(|app| menu::build_app_menu(app))
        .setup(|app| {
            let settings = services::settings::SettingsService::new(app.handle())?;
            let instance_url = settings.get_instance_url();
            app.manage(AppState { settings });

            services::capabilities::register_dev_capabilities(app.handle())?;
            services::capabilities::register_custom_instance_capability(
                app.handle(),
                &instance_url,
            )?;

            #[cfg(not(debug_assertions))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(target) = url::Url::parse(&instance_url) {
                        let _ = window.navigate(target);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::hello::desktop_hello,
            commands::settings::get_instance_url,
            commands::settings::set_instance_url,
            commands::credentials::sync_api_key_to_desktop,
            commands::credentials::get_credential_status,
            commands::credentials::clear_desktop_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TorBox Manager desktop app");
}
