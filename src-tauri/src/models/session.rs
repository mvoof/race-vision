use serde::{Deserialize, Serialize};

/// Источник телеметрии (игра)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TelemetrySource {
    Lmu,
    Acc,
    IRacing,
    Rf2,
    Unknown,
}

impl Default for TelemetrySource {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Тип сессии
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Practice,
    Qualifying,
    Race,
    Hotlap,
    Unknown,
}

impl Default for SessionType {
    fn default() -> Self {
        Self::Unknown
    }
}

impl From<&str> for SessionType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "practice" => SessionType::Practice,
            "qualifying" | "qualify" => SessionType::Qualifying,
            "race" => SessionType::Race,
            "hotlap" | "time_trial" => SessionType::Hotlap,
            _ => SessionType::Unknown,
        }
    }
}

/// Погодные условия
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeatherCondition {
    pub description: String,
    pub track_temp: Option<f32>,
    pub ambient_temp: Option<f32>,
    pub wind_speed: Option<f32>,
    pub wind_heading: Option<f32>,
}

/// Информация о сессии
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub source: TelemetrySource,

    // Файл
    pub file_path: String,
    pub file_name: String,

    // Метаданные
    pub driver_name: String,
    pub recording_time: String,
    pub session_time: String,

    // Трек и машина
    pub track_name: String,
    pub track_layout: String,
    pub car_name: String,
    pub car_class: String,

    // Тип и условия
    pub session_type: SessionType,
    pub weather: WeatherCondition,

    // Статистика
    pub total_laps: u32,
    pub best_lap_time: Option<f64>,
    pub total_duration: f64,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            source: TelemetrySource::Unknown,
            file_path: String::new(),
            file_name: String::new(),
            driver_name: String::new(),
            recording_time: String::new(),
            session_time: String::new(),
            track_name: String::new(),
            track_layout: String::new(),
            car_name: String::new(),
            car_class: String::new(),
            session_type: SessionType::Unknown,
            weather: WeatherCondition::default(),
            total_laps: 0,
            best_lap_time: None,
            total_duration: 0.0,
        }
    }
}

/// Информация о канале телеметрии
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryChannel {
    pub name: String,
    pub frequency: i32,
    pub unit: String,
}
