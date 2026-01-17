use crate::models::{Lap, LapTelemetry, Session, TelemetrySource, TrajectoryPoint};
use std::path::Path;
use thiserror::Error;

/// Ошибки парсера
#[derive(Error, Debug)]
pub enum ParserError {
    #[error("Failed to open file: {0}")]
    FileOpen(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Invalid data format: {0}")]
    InvalidFormat(String),

    #[error("Missing required data: {0}")]
    MissingData(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<duckdb::Error> for ParserError {
    fn from(err: duckdb::Error) -> Self {
        ParserError::Database(err.to_string())
    }
}

/// Результат определения источника
#[derive(Debug, Clone)]
pub struct SourceDetection {
    pub source: TelemetrySource,
    pub confidence: f32,
    pub version: Option<String>,
}

/// Trait для парсеров телеметрии разных игр
pub trait TelemetryParser: Send + Sync {
    /// Источник телеметрии для этого парсера
    fn source(&self) -> TelemetrySource;

    /// Определить, подходит ли этот парсер для файла
    fn detect(&self, path: &Path) -> Result<SourceDetection, ParserError>;

    /// Загрузить метаданные сессии
    fn load_session(&self, path: &Path) -> Result<Session, ParserError>;

    /// Загрузить список кругов
    fn load_laps(&self, path: &Path, session_id: &str) -> Result<Vec<Lap>, ParserError>;

    /// Загрузить телеметрию для конкретного круга
    fn load_lap_telemetry(&self, path: &Path, lap_number: u32)
        -> Result<LapTelemetry, ParserError>;

    /// Загрузить траекторию (облегченная версия для отрисовки)
    fn load_trajectory(
        &self,
        path: &Path,
        lap_number: u32,
    ) -> Result<Vec<TrajectoryPoint>, ParserError>;
}
