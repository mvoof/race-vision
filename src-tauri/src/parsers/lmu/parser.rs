use duckdb::Connection;
use std::path::Path;

use crate::models::*;
use crate::parsers::{ParserError, SourceDetection, TelemetryParser};

/// Парсер телеметрии Le Mans Ultimate
pub struct LmuParser;

impl LmuParser {
    pub fn new() -> Self {
        Self
    }

    fn open_connection(&self, path: &Path) -> Result<Connection, ParserError> {
        Connection::open(path).map_err(|e| ParserError::FileOpen(e.to_string()))
    }

    /// Проверить наличие характерных таблиц LMU
    fn check_lmu_tables(&self, conn: &Connection) -> bool {
        let required_tables = ["metadata", "channelsList", "eventsList"];

        for table in required_tables {
            let result = conn.prepare(&format!("SELECT 1 FROM \"{}\" LIMIT 1", table));
            if result.is_err() {
                return false;
            }
        }
        true
    }

    /// Получить значение из metadata
    fn get_metadata_value(&self, conn: &Connection, key: &str) -> Option<String> {
        conn.query_row("SELECT value FROM metadata WHERE key = ?", [key], |row| {
            row.get::<_, String>(0)
        })
        .ok()
    }

    /// Получить события из таблицы
    fn get_events<T: duckdb::types::FromSql>(
        &self,
        conn: &Connection,
        table: &str,
    ) -> Result<Vec<(f64, T)>, ParserError> {
        let mut stmt = conn.prepare(&format!("SELECT ts, value FROM \"{}\" ORDER BY ts", table))?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, f64>(0)?, row.get::<_, T>(1)?)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// Получить данные канала (скалярные значения)
    fn get_channel_data(&self, conn: &Connection, channel: &str) -> Result<Vec<f32>, ParserError> {
        let mut stmt =
            conn.prepare(&format!("SELECT value FROM \"{}\" ORDER BY rowid", channel))?;
        let rows = stmt.query_map([], |row| row.get::<_, f32>(0))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// Получить данные канала с 4 колёсами
    fn get_wheel_channel_data(
        &self,
        conn: &Connection,
        channel: &str,
    ) -> Result<Vec<[f32; 4]>, ParserError> {
        let mut stmt = conn.prepare(&format!(
            "SELECT value1, value2, value3, value4 FROM \"{}\" ORDER BY rowid",
            channel
        ))?;
        let rows = stmt.query_map([], |row| {
            Ok([
                row.get::<_, f32>(0)?,
                row.get::<_, f32>(1)?,
                row.get::<_, f32>(2)?,
                row.get::<_, f32>(3)?,
            ])
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }
}

impl Default for LmuParser {
    fn default() -> Self {
        Self::new()
    }
}

impl TelemetryParser for LmuParser {
    fn source(&self) -> TelemetrySource {
        TelemetrySource::Lmu
    }

    fn detect(&self, path: &Path) -> Result<SourceDetection, ParserError> {
        let conn = self.open_connection(path)?;

        if self.check_lmu_tables(&conn) {
            let version = self.get_metadata_value(&conn, "Version");
            Ok(SourceDetection {
                source: TelemetrySource::Lmu,
                confidence: 0.95,
                version,
            })
        } else {
            Ok(SourceDetection {
                source: TelemetrySource::Unknown,
                confidence: 0.0,
                version: None,
            })
        }
    }

    fn load_session(&self, path: &Path) -> Result<Session, ParserError> {
        let conn = self.open_connection(path)?;

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Получаем метаданные
        let driver_name = self
            .get_metadata_value(&conn, "DriverName")
            .unwrap_or_default();
        let recording_time = self
            .get_metadata_value(&conn, "RecordingTime")
            .unwrap_or_default();
        let session_time = self
            .get_metadata_value(&conn, "SessionTime")
            .unwrap_or_default();
        let session_type_str = self
            .get_metadata_value(&conn, "SessionType")
            .unwrap_or_default();
        let track_name = self
            .get_metadata_value(&conn, "TrackName")
            .unwrap_or_default();
        let track_layout = self
            .get_metadata_value(&conn, "TrackLayout")
            .unwrap_or_default();
        let weather_str = self
            .get_metadata_value(&conn, "WeatherConditions")
            .unwrap_or_default();
        let car_name = self
            .get_metadata_value(&conn, "CarName")
            .unwrap_or_default();
        let car_class = self
            .get_metadata_value(&conn, "CarClass")
            .unwrap_or_default();

        // Получаем события кругов для подсчета
        let lap_events: Vec<(f64, u16)> = self.get_events(&conn, "Lap").unwrap_or_default();
        let total_laps = lap_events.len() as u32;

        // Получаем лучшее время
        let best_lap_events: Vec<(f64, f32)> =
            self.get_events(&conn, "Best LapTime").unwrap_or_default();
        let best_lap_time = best_lap_events.last().map(|(_, time)| *time as f64);

        // Вычисляем длительность сессии
        let total_duration = lap_events.last().map(|(ts, _)| *ts).unwrap_or(0.0);

        Ok(Session {
            id: uuid::Uuid::new_v4().to_string(),
            source: TelemetrySource::Lmu,
            file_path: path.to_string_lossy().to_string(),
            file_name,
            driver_name,
            recording_time,
            session_time,
            track_name,
            track_layout,
            car_name,
            car_class,
            session_type: SessionType::from(session_type_str.as_str()),
            weather: WeatherCondition {
                description: weather_str,
                ..Default::default()
            },
            total_laps,
            best_lap_time,
            total_duration,
        })
    }

    fn load_laps(&self, path: &Path, session_id: &str) -> Result<Vec<Lap>, ParserError> {
        let conn = self.open_connection(path)?;

        // Получаем события кругов
        let lap_events: Vec<(f64, u16)> = self.get_events(&conn, "Lap")?;

        // Получаем секторы
        let sector1_events: Vec<(f64, f32)> = self
            .get_events(&conn, "Current Sector1")
            .unwrap_or_default();
        let sector2_events: Vec<(f64, f32)> = self
            .get_events(&conn, "Current Sector2")
            .unwrap_or_default();

        // Получаем лучшие времена
        let best_lap_events: Vec<(f64, f32)> =
            self.get_events(&conn, "Best LapTime").unwrap_or_default();
        let best_s1_events: Vec<(f64, f32)> =
            self.get_events(&conn, "Best Sector1").unwrap_or_default();
        let best_s2_events: Vec<(f64, f32)> =
            self.get_events(&conn, "Best Sector2").unwrap_or_default();

        let best_lap_time = best_lap_events.last().map(|(_, t)| *t as f64);
        let best_s1 = best_s1_events.last().map(|(_, t)| *t as f64);
        let best_s2 = best_s2_events.last().map(|(_, t)| *t as f64);

        let mut laps = Vec::new();

        for i in 0..lap_events.len() {
            let (start_ts, lap_num) = lap_events[i];
            let end_ts = lap_events.get(i + 1).map(|(ts, _)| *ts);

            let lap_time = end_ts.map(|end| end - start_ts);

            // Находим секторы для этого круга
            let s1 = sector1_events
                .iter()
                .find(|(ts, _)| *ts >= start_ts && end_ts.is_none_or(|end| *ts < end))
                .map(|(_, t)| *t as f64);

            let s2 = sector2_events
                .iter()
                .find(|(ts, _)| *ts >= start_ts && end_ts.is_none_or(|end| *ts < end))
                .map(|(_, t)| *t as f64);

            // S3 = lap_time - S1 - S2
            let s3 = match (lap_time, s1, s2) {
                (Some(lt), Some(s1), Some(s2)) => Some(lt - s1 - s2),
                _ => None,
            };

            let is_complete = lap_time.is_some();
            let is_personal_best = lap_time == best_lap_time;
            let delta = match (lap_time, best_lap_time) {
                (Some(lt), Some(bt)) => Some(lt - bt),
                _ => None,
            };

            laps.push(Lap {
                id: uuid::Uuid::new_v4().to_string(),
                session_id: session_id.to_string(),
                lap_number: lap_num as u32,
                lap_time,
                sector1_time: s1,
                sector2_time: s2,
                sector3_time: s3,
                start_timestamp: start_ts,
                end_timestamp: end_ts,
                is_valid: true,
                is_complete,
                is_in_lap: lap_num == 0,
                is_out_lap: false,
                is_personal_best,
                is_session_best: is_personal_best,
                is_sector1_best: s1 == best_s1,
                is_sector2_best: s2 == best_s2,
                is_sector3_best: false, // TODO: track best S3
                delta_to_session_best: delta,
                max_speed: None,
                average_speed: None,
                fuel_used: None,
                fuel_at_start: None,
                fuel_at_end: None,
            });
        }

        Ok(laps)
    }

    fn load_lap_telemetry(
        &self,
        path: &Path,
        lap_number: u32,
    ) -> Result<LapTelemetry, ParserError> {
        let conn = self.open_connection(path)?;

        // Получаем события кругов для определения временных границ
        let lap_events: Vec<(f64, u16)> = self.get_events(&conn, "Lap")?;

        if lap_events.is_empty() {
            return Err(ParserError::MissingData("No lap events found".to_string()));
        }

        let lap_idx = lap_events
            .iter()
            .position(|(_, num)| *num as u32 == lap_number)
            .ok_or_else(|| ParserError::MissingData(format!("Lap {} not found", lap_number)))?;

        let start_ts = lap_events[lap_idx].0;
        // Для незавершенного круга используем данные из GPS для определения конца
        let end_ts = match lap_events.get(lap_idx + 1) {
            Some((ts, _)) => *ts,
            None => {
                // Незавершенный круг - попробуем найти последний timestamp из данных
                let dist_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM \"Lap Dist\"", [], |row| row.get(0))
                    .unwrap_or(0);

                if dist_count == 0 {
                    return Err(ParserError::MissingData(
                        "Incomplete lap with no distance data".to_string(),
                    ));
                }

                // Предполагаем 10 Hz для Lap Dist, вычисляем конечный timestamp
                let session_start = lap_events[0].0;
                session_start + (dist_count as f64 / 10.0)
            }
        };

        // Загружаем данные каналов
        // Для простоты используем 10 Hz данные (GPS, G-force, Lap Dist) как базу
        let lat_data = self.get_channel_data(&conn, "GPS Latitude")?;
        let lon_data = self.get_channel_data(&conn, "GPS Longitude")?;
        let dist_data = self.get_channel_data(&conn, "Lap Dist")?;
        let g_lat_data = self.get_channel_data(&conn, "G Force Lat")?;
        let g_long_data = self.get_channel_data(&conn, "G Force Long")?;

        // 100 Hz данные
        let speed_data = self.get_channel_data(&conn, "Ground Speed")?;
        let rpm_data = self.get_channel_data(&conn, "Engine RPM")?;
        let steering_data = self.get_channel_data(&conn, "Steering Pos")?;

        // 50 Hz данные
        let throttle_data = self.get_channel_data(&conn, "Throttle Pos")?;
        let brake_data = self.get_channel_data(&conn, "Brake Pos")?;

        // 20 Hz данные
        let fuel_data = self.get_channel_data(&conn, "Fuel Level")?;

        // 10 Hz 4-wheel данные
        let tire_pressure = self
            .get_wheel_channel_data(&conn, "TyresPressure")
            .unwrap_or_default();
        let tire_wear = self
            .get_wheel_channel_data(&conn, "Tyres Wear")
            .unwrap_or_default();

        // Gear события
        let gear_events: Vec<(f64, i8)> = self.get_events(&conn, "Gear").unwrap_or_default();

        // Определяем индексы для данного круга (10 Hz базовая частота)
        let sample_rate = 10.0_f32;
        let duration = end_ts - start_ts;

        // Безопасный расчёт количества samples (максимум 1 час = 36000 samples)
        const MAX_SAMPLES: usize = 36000;
        let num_samples = (duration * sample_rate as f64)
            .min(MAX_SAMPLES as f64)
            .max(0.0) as usize;

        if num_samples == 0 {
            return Err(ParserError::MissingData("Lap has no telemetry data".to_string()));
        }

        // Channel data arrays are indexed from session start (time=0), not from
        // the first lap event.  Use absolute start_ts so we read from the correct
        // offset inside the channel data.
        let start_idx_10hz = (start_ts * sample_rate as f64).max(0.0) as usize;

        // Создаём samples
        let mut samples = Vec::with_capacity(num_samples);

        for i in 0..num_samples {
            let idx_10hz = start_idx_10hz + i;
            let idx_100hz = idx_10hz * 10; // 100 Hz = 10x от 10 Hz
            let idx_50hz = idx_10hz * 5; // 50 Hz = 5x от 10 Hz
            let idx_20hz = idx_10hz * 2; // 20 Hz = 2x от 10 Hz

            let timestamp = i as f64 / sample_rate as f64;

            // Находим текущую передачу
            let current_ts = start_ts + timestamp;
            let gear = gear_events
                .iter()
                .filter(|(ts, _)| *ts <= current_ts)
                .next_back()
                .map(|(_, g)| *g)
                .unwrap_or(0);

            samples.push(TelemetrySample {
                timestamp,
                lap_distance: *dist_data.get(idx_10hz).unwrap_or(&0.0),
                total_distance: 0.0,
                pos_x: *lat_data.get(idx_10hz).unwrap_or(&0.0),
                pos_y: *lon_data.get(idx_10hz).unwrap_or(&0.0),
                speed: *speed_data.get(idx_100hz).unwrap_or(&0.0),
                wheel_speed: [0.0; 4],
                throttle: *throttle_data.get(idx_50hz).unwrap_or(&0.0),
                brake: *brake_data.get(idx_50hz).unwrap_or(&0.0),
                clutch: 0.0,
                steering: *steering_data.get(idx_100hz).unwrap_or(&0.0),
                rpm: *rpm_data.get(idx_100hz).unwrap_or(&0.0),
                gear,
                g_force_x: *g_lat_data.get(idx_10hz).unwrap_or(&0.0),
                g_force_y: *g_long_data.get(idx_10hz).unwrap_or(&0.0),
                g_force_z: 0.0,
                tire_temp_left: [0.0; 4],
                tire_temp_center: [0.0; 4],
                tire_temp_right: [0.0; 4],
                tire_pressure: *tire_pressure.get(idx_10hz).unwrap_or(&[0.0; 4]),
                tire_wear: *tire_wear.get(idx_10hz).unwrap_or(&[100.0; 4]),
                brake_temp: [0.0; 4],
                fuel_level: *fuel_data.get(idx_20hz).unwrap_or(&0.0),
                suspension_pos: [0.0; 4],
                ride_height_front: 0.0,
                ride_height_rear: 0.0,
            });
        }

        let distance = samples.last().map(|s| s.lap_distance).unwrap_or(0.0);

        Ok(LapTelemetry {
            lap_number,
            samples,
            sample_rate,
            duration,
            distance,
        })
    }

    fn load_trajectory(
        &self,
        path: &Path,
        lap_number: u32,
    ) -> Result<Vec<TrajectoryPoint>, ParserError> {
        let conn = self.open_connection(path)?;

        // Получаем события кругов
        let lap_events: Vec<(f64, u16)> = self.get_events(&conn, "Lap")?;

        if lap_events.is_empty() {
            return Err(ParserError::MissingData("No lap events found".to_string()));
        }

        let lap_idx = lap_events
            .iter()
            .position(|(_, num)| *num as u32 == lap_number)
            .ok_or_else(|| ParserError::MissingData(format!("Lap {} not found", lap_number)))?;

        let start_ts = lap_events[lap_idx].0;
        // Для незавершенного круга используем данные из GPS для определения конца
        let end_ts = match lap_events.get(lap_idx + 1) {
            Some((ts, _)) => *ts,
            None => {
                // Незавершенный круг - попробуем найти последний timestamp из данных
                let dist_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM \"Lap Dist\"", [], |row| row.get(0))
                    .unwrap_or(0);

                if dist_count == 0 {
                    return Err(ParserError::MissingData(
                        "Incomplete lap with no distance data".to_string(),
                    ));
                }

                let session_start = lap_events[0].0;
                session_start + (dist_count as f64 / 10.0)
            }
        };

        // Загружаем 10 Hz данные
        let lat_data = self.get_channel_data(&conn, "GPS Latitude")?;
        let lon_data = self.get_channel_data(&conn, "GPS Longitude")?;
        let dist_data = self.get_channel_data(&conn, "Lap Dist")?;

        // 100 Hz скорость
        let speed_data = self.get_channel_data(&conn, "Ground Speed")?;

        // 50 Hz inputs
        let throttle_data = self.get_channel_data(&conn, "Throttle Pos")?;
        let brake_data = self.get_channel_data(&conn, "Brake Pos")?;

        let sample_rate = 10.0_f32;
        let duration = end_ts - start_ts;

        // Безопасный расчёт количества samples (максимум 1 час = 36000 samples)
        const MAX_SAMPLES: usize = 36000;
        let num_samples = (duration * sample_rate as f64)
            .min(MAX_SAMPLES as f64)
            .max(0.0) as usize;

        if num_samples == 0 {
            return Err(ParserError::MissingData(
                "Lap has no trajectory data".to_string(),
            ));
        }

        // Channel data arrays are indexed from session start (time=0).
        let start_idx = (start_ts * sample_rate as f64).max(0.0) as usize;

        let mut points = Vec::with_capacity(num_samples);

        for i in 0..num_samples {
            let idx_10hz = start_idx + i;
            let idx_100hz = idx_10hz * 10;
            let idx_50hz = idx_10hz * 5;

            points.push(TrajectoryPoint {
                x: *lat_data.get(idx_10hz).unwrap_or(&0.0),
                y: *lon_data.get(idx_10hz).unwrap_or(&0.0),
                distance: *dist_data.get(idx_10hz).unwrap_or(&0.0),
                speed: *speed_data.get(idx_100hz).unwrap_or(&0.0),
                throttle: throttle_data.get(idx_50hz).copied(),
                brake: brake_data.get(idx_50hz).copied(),
            });
        }

        Ok(points)
    }
}
