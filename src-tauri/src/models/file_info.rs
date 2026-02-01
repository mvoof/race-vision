use serde::{Deserialize, Serialize};

/// Информация о файле телеметрии для отображения в списке
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFileInfo {
    /// Полный путь к файлу
    pub path: String,
    /// Имя файла
    pub file_name: String,
    /// Название трека (из metadata)
    pub track_name: Option<String>,
    /// Название машины (из metadata)
    pub car_name: Option<String>,
    /// Тип сессии (из metadata)
    pub session_type: Option<String>,
    /// Имя драйвера (из metadata)
    pub driver_name: Option<String>,
    /// Время записи (из metadata)
    pub recording_time: Option<String>,
    /// Размер файла в байтах
    pub file_size: u64,
    /// Время модификации файла (Unix timestamp)
    pub modified_time: i64,
}
