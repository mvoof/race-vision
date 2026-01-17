pub mod commands;
pub mod db;
pub mod models;
pub mod parsers;

use commands::*;
use db::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            open_telemetry_file,
            get_session_info,
            get_laps,
            get_lap_telemetry,
            get_trajectory,
            scan_telemetry_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
