mod commands;
mod constants;
mod launch_args;
mod macos_app_icon;
mod macos_display_name;
mod menu;
mod services;
mod state;

use std::sync::Arc;

use tauri::{Manager, RunEvent};

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    macos_display_name::apply_process_display_name(constants::APP_DISPLAY_NAME);

    let builder = {
        #[cfg(not(target_os = "macos"))]
        {
            tauri::Builder::default().plugin(
                tauri_plugin_autostart::Builder::new()
                    .app_name(constants::APP_DISPLAY_NAME)
                    .args([constants::START_HIDDEN_LAUNCH_ARG])
                    .build(),
            )
        }
        #[cfg(target_os = "macos")]
        {
            tauri::Builder::default()
        }
    };

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .menu(|app| menu::build_app_menu(app))
        .setup(|app| {
            let settings = Arc::new(services::settings::SettingsService::new(app.handle())?);
            let notifications = services::notifications::NotificationService::new(Arc::clone(
                &settings,
            ));
            let folder_watcher = services::folder_watcher::FolderWatcherService::new(
                app.handle().clone(),
                Arc::clone(&settings),
            )?;

            app.manage(AppState {
                settings: Arc::clone(&settings),
                folder_watcher,
                notifications,
            });

            commands::autostart::sync_launch_at_login(app.handle(), &settings);

            services::capabilities::register_dev_capabilities(app.handle())?;
            services::capabilities::register_custom_instance_capability(
                app.handle(),
                &settings.get_instance_url(),
            )?;

            services::tray::setup_tray(app.handle())?;
            services::tray::register_window_behavior(app.handle(), &settings)?;

            #[cfg(target_os = "macos")]
            macos_app_icon::apply_dock_icon();

            if let Some(window) = app.get_webview_window("main") {
                services::window_state::restore_window_geometry(&window, settings.as_ref());
                services::window_state::restore_web_location(&window, settings.as_ref());
            }

            services::tray::apply_start_hidden_if_needed(app.handle(), settings.as_ref());

            if let Some(state) = app.try_state::<AppState>() {
                let _ = state.folder_watcher.try_auto_start();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::hello::desktop_hello,
            commands::settings::get_instance_url,
            commands::settings::set_instance_url,
            commands::navigation::set_last_web_path,
            commands::credentials::sync_api_key_to_desktop,
            commands::credentials::get_credential_status,
            commands::credentials::clear_desktop_credential,
            commands::picker::pick_folder,
            commands::picker::pick_move_destination_folder,
            commands::watcher::get_folder_watcher_config,
            commands::watcher::set_folder_watcher_config,
            commands::watcher::start_folder_watcher,
            commands::watcher::stop_folder_watcher,
            commands::watcher::get_folder_watcher_status,
            commands::autostart::get_launch_at_login,
            commands::autostart::set_launch_at_login,
            commands::tray::get_tray_settings,
            commands::tray::set_tray_settings,
            commands::tray::show_main_window_command,
            commands::tray::hide_main_window_command,
            commands::notifications::get_notification_settings,
            commands::notifications::set_notification_settings,
            commands::notifications::show_test_notification,
            commands::updates::check_for_update_command,
            commands::updates::install_update_command,
            commands::window_presence::get_window_engaged,
        ])
        .build(tauri::generate_context!())
        .expect("error while building TorBox Manager desktop app")
        .run(|app, event| {
            services::tray::handle_run_event(app, &event);

            if matches!(event, RunEvent::Exit) {
                if let Some(state) = app.try_state::<AppState>() {
                    services::window_state::persist_main_window_state(
                        app,
                        state.settings.as_ref(),
                    );
                    state.folder_watcher.shutdown();
                }
            }
        });
}
