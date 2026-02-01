use serde::{Deserialize, Serialize};

/// Данные для 4 колёс [FL, FR, RL, RR]
pub type WheelData = [f32; 4];

/// Единичный sample телеметрии (нормализованный)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySample {
    // Время и позиция
    pub timestamp: f64,
    pub lap_distance: f32,
    pub total_distance: f32,

    // Позиция в пространстве
    pub pos_x: f32,
    pub pos_y: f32,

    // Скорость
    pub speed: f32,
    pub wheel_speed: WheelData,

    // Inputs
    pub throttle: f32,
    pub brake: f32,
    pub clutch: f32,
    pub steering: f32,

    // Двигатель
    pub rpm: f32,
    pub gear: i8,

    // G-силы
    pub g_force_x: f32,
    pub g_force_y: f32,
    pub g_force_z: f32,

    // Шины - температуры
    pub tire_temp_left: WheelData,
    pub tire_temp_center: WheelData,
    pub tire_temp_right: WheelData,

    // Шины - другое
    pub tire_pressure: WheelData,
    pub tire_wear: WheelData,

    // Тормоза
    pub brake_temp: WheelData,

    // Топливо
    pub fuel_level: f32,

    // Подвеска
    pub suspension_pos: WheelData,
    pub ride_height_front: f32,
    pub ride_height_rear: f32,
}

/// Облегчённые данные для отрисовки траектории
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrajectoryPoint {
    pub x: f32,
    pub y: f32,
    pub distance: f32,
    pub speed: f32,
    pub throttle: Option<f32>,
    pub brake: Option<f32>,
}

/// Данные телеметрии для одного круга
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LapTelemetry {
    pub lap_number: u32,
    pub samples: Vec<TelemetrySample>,
    pub sample_rate: f32,
    pub duration: f64,
    pub distance: f32,
}

impl Default for LapTelemetry {
    fn default() -> Self {
        Self {
            lap_number: 0,
            samples: Vec::new(),
            sample_rate: 10.0,
            duration: 0.0,
            distance: 0.0,
        }
    }
}

/// Точка границы трека (envelope из всех телеметрий)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackBoundaryPoint {
    /// Дистанция вдоль трека
    pub distance: f32,
    /// Минимальные координаты (самая внутренняя точка)
    pub min_x: f32,
    pub min_y: f32,
    /// Максимальные координаты (самая внешняя точка)
    pub max_x: f32,
    pub max_y: f32,
    /// Центральная линия (среднее всех траекторий)
    pub center_x: f32,
    pub center_y: f32,
    /// Количество проходов через эту точку
    pub sample_count: u32,
}

/// Envelope границ трека на основе всех телеметрий
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackBoundaryEnvelope {
    /// Имя трека
    pub track_name: String,
    /// Общая длина трека
    pub track_length: f32,
    /// Точки границ
    pub points: Vec<TrackBoundaryPoint>,
    /// Количество проанализированных кругов
    pub total_laps: u32,
    /// Количество проанализированных файлов
    pub total_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Corner {
    pub id: u32,
    pub name: String,
    pub start_index: usize,
    pub end_index: usize,
    pub apex_index: usize,
    pub min_speed: f32,
    pub entry_speed: f32,
    pub exit_speed: f32,
    pub turn_direction: String, // "left" or "right"
    pub max_curvature: f32,
}
