use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::State;

use crate::db::AppState;
use crate::models::{Lap, LapTelemetry, Session, TelemetryFileInfo, TrajectoryPoint};

/// Открыть файл телеметрии
#[tauri::command]
pub async fn open_telemetry_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    let path = PathBuf::from(&path);

    // Находим подходящий парсер
    let parser = state
        .parser_registry
        .detect_parser(&path)
        .ok_or_else(|| "Unknown file format or unsupported telemetry source".to_string())?;

    // Загружаем сессию
    let session = parser
        .load_session(&path)
        .map_err(|e| e.to_string())?;

    // Сохраняем состояние
    state.set_current_file(path);
    state.set_current_session(session.clone());

    Ok(session)
}

/// Получить информацию о текущей сессии
#[tauri::command]
pub async fn get_session_info(state: State<'_, AppState>) -> Result<Session, String> {
    state
        .get_current_session()
        .ok_or_else(|| "No session loaded".to_string())
}

/// Получить список кругов
#[tauri::command]
pub async fn get_laps(state: State<'_, AppState>) -> Result<Vec<Lap>, String> {
    let path = state
        .get_current_file()
        .ok_or_else(|| "No file opened".to_string())?;

    let session = state
        .get_current_session()
        .ok_or_else(|| "No session loaded".to_string())?;

    let parser = state
        .parser_registry
        .detect_parser(&path)
        .ok_or_else(|| "Parser not found".to_string())?;

    parser
        .load_laps(&path, &session.id)
        .map_err(|e| e.to_string())
}

/// Получить телеметрию для круга
#[tauri::command]
pub async fn get_lap_telemetry(
    lap_number: u32,
    state: State<'_, AppState>,
) -> Result<LapTelemetry, String> {
    let path = state
        .get_current_file()
        .ok_or_else(|| "No file opened".to_string())?;

    let parser = state
        .parser_registry
        .detect_parser(&path)
        .ok_or_else(|| "Parser not found".to_string())?;

    parser
        .load_lap_telemetry(&path, lap_number)
        .map_err(|e| e.to_string())
}

/// Получить траекторию для отрисовки
#[tauri::command]
pub async fn get_trajectory(
    lap_number: u32,
    state: State<'_, AppState>,
) -> Result<Vec<TrajectoryPoint>, String> {
    let path = state
        .get_current_file()
        .ok_or_else(|| "No file opened".to_string())?;

    let parser = state
        .parser_registry
        .detect_parser(&path)
        .ok_or_else(|| "Parser not found".to_string())?;

    parser
        .load_trajectory(&path, lap_number)
        .map_err(|e| e.to_string())
}

/// Сканировать папку с телеметрией и получить список файлов
#[tauri::command]
pub async fn scan_telemetry_folder(folder_path: String) -> Result<Vec<TelemetryFileInfo>, String> {
    let folder = PathBuf::from(&folder_path);

    if !folder.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !folder.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut files: Vec<TelemetryFileInfo> = Vec::new();

    // Читаем содержимое папки
    let entries = fs::read_dir(&folder).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();

        // Проверяем расширение файла
        if let Some(ext) = path.extension() {
            if ext == "duckdb" || ext == "db" {
                // Получаем метаданные файла
                if let Ok(metadata) = fs::metadata(&path) {
                    let file_size = metadata.len();
                    let modified_time = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);

                    let file_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    // Пытаемся получить метаданные из файла
                    let (track_name, car_name, session_type, driver_name, recording_time) =
                        if let Ok(conn) = duckdb::Connection::open(&path) {
                            let track = get_metadata_value(&conn, "TrackName");
                            let car = get_metadata_value(&conn, "CarName");
                            let session = get_metadata_value(&conn, "SessionType");
                            let driver = get_metadata_value(&conn, "DriverName");
                            let recording = get_metadata_value(&conn, "RecordingTime");
                            (track, car, session, driver, recording)
                        } else {
                            (None, None, None, None, None)
                        };

                    files.push(TelemetryFileInfo {
                        path: path.to_string_lossy().to_string(),
                        file_name,
                        track_name,
                        car_name,
                        session_type,
                        driver_name,
                        recording_time,
                        file_size,
                        modified_time,
                    });
                }
            }
        }
    }

    // Сортируем по времени модификации (новые первые)
    files.sort_by(|a, b| b.modified_time.cmp(&a.modified_time));

    Ok(files)
}

/// Вспомогательная функция для получения значения из metadata
fn get_metadata_value(conn: &duckdb::Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM metadata WHERE key = ?", [key], |row| {
        row.get::<_, String>(0)
    })
    .ok()
}
