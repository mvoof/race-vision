pub mod commands;
pub mod db;
pub mod models;
pub mod parsers;

use commands::*;
use db::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_devtools::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            open_telemetry_file,
            get_session_info,
            get_laps,
            get_lap_telemetry,
            get_trajectory,
            scan_telemetry_folder,
            analyze_track_boundaries,
            commands::analysis::analyze_corners,
            commands::track::generate_boundaries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
