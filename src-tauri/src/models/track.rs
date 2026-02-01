use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point2D {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceLinePoint {
    pub x: f32,
    pub y: f32,
    pub s: f32,
    pub heading: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceLine {
    pub points: Vec<ReferenceLinePoint>,
    pub total_length: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundarySegment {
    pub s: f32,
    pub d_left: f32,
    pub d_right: f32,
    pub samples: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputedTrackBoundary {
    pub track_name: String,
    pub track_layout: String,
    pub reference_line: ReferenceLine,
    pub segments: Vec<BoundarySegment>,
    pub left_boundary: Vec<Point2D>,
    pub right_boundary: Vec<Point2D>,
    pub total_laps: u32,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundaryGeneratorOptions {
    pub segment_size: f32,
    pub fallback_width: f32,
    pub smooth_window: usize,
    pub min_samples_per_segment: u32,
    pub outlier_threshold: f32,
}

impl Default for BoundaryGeneratorOptions {
    fn default() -> Self {
        Self {
            segment_size: 5.0,
            fallback_width: 6.0,
            smooth_window: 5,
            min_samples_per_segment: 3,
            outlier_threshold: 15.0,
        }
    }
}