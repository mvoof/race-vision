use serde::{Deserialize, Serialize};

/// Информация о круге
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lap {
    pub id: String,
    pub session_id: String,
    pub lap_number: u32,

    // Время круга
    pub lap_time: Option<f64>,
    pub sector1_time: Option<f64>,
    pub sector2_time: Option<f64>,
    pub sector3_time: Option<f64>,

    // Timestamps
    pub start_timestamp: f64,
    pub end_timestamp: Option<f64>,

    // Статус
    pub is_valid: bool,
    pub is_complete: bool,
    pub is_in_lap: bool,
    pub is_out_lap: bool,

    // Флаги лучших результатов
    pub is_personal_best: bool,
    pub is_session_best: bool,
    pub is_sector1_best: bool,
    pub is_sector2_best: bool,
    pub is_sector3_best: bool,

    // Delta
    pub delta_to_session_best: Option<f64>,

    // Статистика
    pub max_speed: Option<f64>,
    pub average_speed: Option<f64>,
    pub fuel_used: Option<f64>,
    pub fuel_at_start: Option<f64>,
    pub fuel_at_end: Option<f64>,
}

impl Default for Lap {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            session_id: String::new(),
            lap_number: 0,
            lap_time: None,
            sector1_time: None,
            sector2_time: None,
            sector3_time: None,
            start_timestamp: 0.0,
            end_timestamp: None,
            is_valid: true,
            is_complete: false,
            is_in_lap: false,
            is_out_lap: false,
            is_personal_best: false,
            is_session_best: false,
            is_sector1_best: false,
            is_sector2_best: false,
            is_sector3_best: false,
            delta_to_session_best: None,
            max_speed: None,
            average_speed: None,
            fuel_used: None,
            fuel_at_start: None,
            fuel_at_end: None,
        }
    }
}

/// Краткая информация о круге для списка
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LapSummary {
    pub lap_number: u32,
    pub lap_time: Option<f64>,
    pub sector1_time: Option<f64>,
    pub sector2_time: Option<f64>,
    pub sector3_time: Option<f64>,
    pub is_valid: bool,
    pub is_personal_best: bool,
    pub delta_to_session_best: Option<f64>,
}

impl From<&Lap> for LapSummary {
    fn from(lap: &Lap) -> Self {
        Self {
            lap_number: lap.lap_number,
            lap_time: lap.lap_time,
            sector1_time: lap.sector1_time,
            sector2_time: lap.sector2_time,
            sector3_time: lap.sector3_time,
            is_valid: lap.is_valid,
            is_personal_best: lap.is_personal_best,
            delta_to_session_best: lap.delta_to_session_best,
        }
    }
}
