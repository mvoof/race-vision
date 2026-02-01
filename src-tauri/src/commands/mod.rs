use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::State;

use crate::db::AppState;
use crate::models::{Lap, LapTelemetry, Session, TelemetryFileInfo, TrajectoryPoint, TrackBoundaryEnvelope, TrackBoundaryPoint};

pub mod analysis;
pub mod visualization;
pub mod track;

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

/// Анализировать все телеметрии для трека и построить envelope границ
#[tauri::command]
pub async fn analyze_track_boundaries(
    folder_path: String,
    track_name: String,
    state: State<'_, AppState>,
) -> Result<TrackBoundaryEnvelope, String> {
    use std::collections::HashMap;

    let folder = PathBuf::from(&folder_path);

    if !folder.exists() {
        return Err("Folder does not exist".to_string());
    }

    // Шаг 1: Найти все файлы для данного трека
    let mut track_files: Vec<PathBuf> = Vec::new();
    let entries = fs::read_dir(&folder).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(ext) = path.extension() {
            if ext == "duckdb" || ext == "db" {
                // Проверяем название трека
                if let Ok(conn) = duckdb::Connection::open(&path) {
                    if let Some(file_track) = get_metadata_value(&conn, "TrackName") {
                        if file_track == track_name {
                            track_files.push(path);
                        }
                    }
                }
            }
        }
    }

    if track_files.is_empty() {
        return Err(format!("No telemetry files found for track: {}", track_name));
    }

    // Шаг 2: Собрать все траектории из всех файлов
    let mut all_trajectories: Vec<Vec<TrajectoryPoint>> = Vec::new();
    let mut total_laps = 0u32;

    for file_path in &track_files {
        let parser = state
            .parser_registry
            .detect_parser(file_path)
            .ok_or_else(|| "Parser not found".to_string())?;

        // Загружаем сессию чтобы получить ID
        let session = parser
            .load_session(file_path)
            .map_err(|e| e.to_string())?;

        // Загружаем список кругов
        let laps = parser
            .load_laps(file_path, &session.id)
            .map_err(|e| e.to_string())?;

        // Загружаем траекторию каждого круга
        for lap in laps {
            match parser.load_trajectory(file_path, lap.lap_number) {
                Ok(trajectory) => {
                    if !trajectory.is_empty() {
                        all_trajectories.push(trajectory);
                        total_laps += 1;
                    }
                }
                Err(_) => {
                    // Пропускаем круги с ошибками
                    continue;
                }
            }
        }
    }

    if all_trajectories.is_empty() {
        return Err("No valid trajectories found".to_string());
    }

    // Шаг 3: Построить envelope - группируем точки по дистанции
    // Используем HashMap где ключ - округленная дистанция (в метрах)
    let mut distance_buckets: HashMap<i32, Vec<(f32, f32)>> = HashMap::new();
    let mut max_distance = 0.0f32;

    for trajectory in &all_trajectories {
        for point in trajectory {
            // Округляем дистанцию до метра
            let distance_key = point.distance.round() as i32;
            distance_buckets
                .entry(distance_key)
                .or_insert_with(Vec::new)
                .push((point.x, point.y));

            if point.distance > max_distance {
                max_distance = point.distance;
            }
        }
    }

    // Шаг 4: Для каждой дистанции вычислить min/max/center
    let mut boundary_points: Vec<TrackBoundaryPoint> = Vec::new();

    for distance_key in 0..=(max_distance.round() as i32) {
        if let Some(points) = distance_buckets.get(&distance_key) {
            if points.is_empty() {
                continue;
            }

            let min_x = points.iter().map(|(x, _)| x).fold(f32::INFINITY, |a, &b| a.min(b));
            let max_x = points.iter().map(|(x, _)| x).fold(f32::NEG_INFINITY, |a, &b| a.max(b));
            let min_y = points.iter().map(|(_, y)| y).fold(f32::INFINITY, |a, &b| a.min(b));
            let max_y = points.iter().map(|(_, y)| y).fold(f32::NEG_INFINITY, |a, &b| a.max(b));

            let center_x = points.iter().map(|(x, _)| x).sum::<f32>() / points.len() as f32;
            let center_y = points.iter().map(|(_, y)| y).sum::<f32>() / points.len() as f32;

            boundary_points.push(TrackBoundaryPoint {
                distance: distance_key as f32,
                min_x,
                min_y,
                max_x,
                max_y,
                center_x,
                center_y,
                sample_count: points.len() as u32,
            });
        }
    }

    // Сортируем по дистанции
    boundary_points.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap());

    Ok(TrackBoundaryEnvelope {
        track_name,
        track_length: max_distance,
        points: boundary_points,
        total_laps,
        total_files: track_files.len() as u32,
    })
}
