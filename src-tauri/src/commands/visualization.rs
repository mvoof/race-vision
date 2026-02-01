use serde::{Deserialize, Serialize};
use tauri::command;

use crate::models::TrajectoryPoint;

// ─── Output Types ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldPoint {
    pub x: f64,
    pub y: f64,
    pub speed: f32,
    pub distance: f32,
    pub throttle: Option<f32>,
    pub brake: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoBounds {
    pub min_lon: f64,
    pub max_lon: f64,
    pub min_lat: f64,
    pub max_lat: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackViewData {
    pub world_points: Vec<WorldPoint>,
    pub colors: Vec<String>,
    pub bounds: GeoBounds,
    pub scale: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffsetBoundaries {
    pub left: Vec<Point2D>,
    pub right: Vec<Point2D>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPosition {
    pub x: f64,
    pub y: f64,
    pub heading: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeWorldPoints {
    pub inner: Vec<Point2D>,
    pub outer: Vec<Point2D>,
    pub center: Vec<Point2D>,
}

// ─── B1: prepare_track_view ─────────────────────────────────
// Combines: bounds calculation → Mercator transform → world points → color array
// Replaces 4 JS useMemo chains in a single IPC call.

#[command]
pub async fn prepare_track_view(
    trajectory: Vec<TrajectoryPoint>,
    canvas_width: f64,
    canvas_height: f64,
    padding: f64,
    color_mode: String,
    track_color: String,
) -> Result<TrackViewData, String> {
    if trajectory.is_empty() {
        return Ok(TrackViewData {
            world_points: vec![],
            colors: vec![],
            bounds: GeoBounds {
                min_lon: 0.0,
                max_lon: 0.0,
                min_lat: 0.0,
                max_lat: 0.0,
            },
            scale: 1.0,
            offset_x: 0.0,
            offset_y: 0.0,
        });
    }

    // Step 1: Calculate bounds
    // In LMU telemetry: x = latitude, y = longitude
    let mut min_lon = f64::INFINITY;
    let mut max_lon = f64::NEG_INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lat = f64::NEG_INFINITY;

    for p in &trajectory {
        let lat = p.x as f64;
        let lon = p.y as f64;
        if lon < min_lon { min_lon = lon; }
        if lon > max_lon { max_lon = lon; }
        if lat < min_lat { min_lat = lat; }
        if lat > max_lat { max_lat = lat; }
    }

    let bounds = GeoBounds { min_lon, max_lon, min_lat, max_lat };

    // Step 2: Create Mercator coordinate transform
    let avg_lat = (min_lat + max_lat) / 2.0;
    let lat_correction = (avg_lat * std::f64::consts::PI / 180.0).cos();

    let lon_range = (max_lon - min_lon) * lat_correction;
    let lat_range = max_lat - min_lat;

    let effective_lon_range = if lon_range == 0.0 { 0.0001 } else { lon_range };
    let effective_lat_range = if lat_range == 0.0 { 0.0001 } else { lat_range };

    let available_width = canvas_width - padding * 2.0;
    let available_height = canvas_height - padding * 2.0;

    let scale_x = available_width / effective_lon_range;
    let scale_y = available_height / effective_lat_range;
    let scale = scale_x.min(scale_y);

    let scaled_width = effective_lon_range * scale;
    let scaled_height = effective_lat_range * scale;

    let offset_x = padding + (available_width - scaled_width) / 2.0;
    let offset_y = padding + (available_height - scaled_height) / 2.0;

    // Step 3: Transform trajectory to world (SVG) coordinates
    let world_points: Vec<WorldPoint> = trajectory
        .iter()
        .map(|p| {
            let lon = p.y as f64;
            let lat = p.x as f64;
            let x = (lon - min_lon) * lat_correction * scale + offset_x;
            let y = canvas_height - offset_y - (lat - min_lat) * scale;
            WorldPoint {
                x,
                y,
                speed: p.speed,
                distance: p.distance,
                throttle: p.throttle,
                brake: p.brake,
            }
        })
        .collect();

    // Step 4: Pre-compute color array
    let colors = compute_colors(&world_points, &color_mode, &track_color);

    Ok(TrackViewData {
        world_points,
        colors,
        bounds,
        scale,
        offset_x,
        offset_y,
    })
}

fn compute_colors(points: &[WorldPoint], color_mode: &str, track_color: &str) -> Vec<String> {
    if points.len() < 2 {
        return vec![];
    }

    let n = points.len() - 1;

    if color_mode == "solid" {
        return vec![track_color.to_string(); n];
    }

    // Find min/max speed
    let mut min_speed = f32::INFINITY;
    let mut max_speed = f32::NEG_INFINITY;
    for p in points {
        if p.speed < min_speed { min_speed = p.speed; }
        if p.speed > max_speed { max_speed = p.speed; }
    }

    let mut colors = Vec::with_capacity(n);
    for i in 0..n {
        let p = &points[i];
        let color = match color_mode {
            "speed" => speed_to_color(p.speed, min_speed, max_speed),
            "throttle" | "brake" => throttle_brake_to_color(
                p.throttle.unwrap_or(0.0),
                p.brake.unwrap_or(0.0),
            ),
            _ => speed_to_color(p.speed, min_speed, max_speed),
        };
        colors.push(color);
    }
    colors
}

fn speed_to_color(speed: f32, min_speed: f32, max_speed: f32) -> String {
    let range = if (max_speed - min_speed).abs() < 0.001 { 1.0 } else { max_speed - min_speed };
    let normalized = ((speed - min_speed) / range).clamp(0.0, 1.0);
    let hue = (normalized * 120.0) as u32;
    format!("hsl({}, 80%, 50%)", hue)
}

fn throttle_brake_to_color(throttle: f32, brake: f32) -> String {
    if brake > 10.0 {
        let sat = brake.min(100.0) as u32;
        return format!("hsl(0, {}%, 50%)", sat);
    }
    if throttle > 10.0 {
        let sat = throttle.min(100.0) as u32;
        return format!("hsl(120, {}%, 50%)", sat);
    }
    "hsl(0, 0%, 40%)".to_string()
}

// ─── B2: find_nearest_point ─────────────────────────────────
// Grid-based spatial search. We build + search in one call to avoid
// holding mutable state. For a 2000-point trajectory this is ~0.1ms.

#[command]
pub async fn find_nearest_point(
    world_points: Vec<WorldPoint>,
    world_x: f64,
    world_y: f64,
) -> Result<i32, String> {
    if world_points.is_empty() {
        return Ok(-1);
    }

    // Find bounding box
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;

    for p in &world_points {
        if p.x < min_x { min_x = p.x; }
        if p.x > max_x { max_x = p.x; }
        if p.y < min_y { min_y = p.y; }
        if p.y > max_y { max_y = p.y; }
    }

    let range_x = if max_x - min_x == 0.0 { 1.0 } else { max_x - min_x };
    let range_y = if max_y - min_y == 0.0 { 1.0 } else { max_y - min_y };
    let avg_range = (range_x + range_y) / 2.0;
    let cell_size = avg_range / (world_points.len() as f64).sqrt().max(1.0);

    // Build grid
    use std::collections::HashMap;
    let mut cells: HashMap<(i32, i32), Vec<usize>> = HashMap::new();

    for (i, p) in world_points.iter().enumerate() {
        let col = ((p.x - min_x) / cell_size).floor() as i32;
        let row = ((p.y - min_y) / cell_size).floor() as i32;
        cells.entry((col, row)).or_default().push(i);
    }

    // Search 3x3 neighbourhood
    let col = ((world_x - min_x) / cell_size).floor() as i32;
    let row = ((world_y - min_y) / cell_size).floor() as i32;

    let mut best_idx: i32 = -1;
    let mut best_dist = f64::INFINITY;

    for dc in -1..=1 {
        for dr in -1..=1 {
            if let Some(bucket) = cells.get(&(col + dc, row + dr)) {
                for &idx in bucket {
                    let dx = world_points[idx].x - world_x;
                    let dy = world_points[idx].y - world_y;
                    let dist = dx * dx + dy * dy;
                    if dist < best_dist {
                        best_dist = dist;
                        best_idx = idx as i32;
                    }
                }
            }
        }
    }

    // Fallback brute-force if 3x3 was empty
    if best_idx == -1 {
        for (i, p) in world_points.iter().enumerate() {
            let dx = p.x - world_x;
            let dy = p.y - world_y;
            let dist = dx * dx + dy * dy;
            if dist < best_dist {
                best_dist = dist;
                best_idx = i as i32;
            }
        }
    }

    Ok(best_idx)
}

// ─── B3: interpolate_cursor_position ────────────────────────
// Binary search + linear interpolation on world points.

#[command]
pub async fn interpolate_cursor_position(
    world_points: Vec<WorldPoint>,
    distance: f64,
) -> Result<Option<CursorPosition>, String> {
    if world_points.len() < 2 {
        return Ok(None);
    }

    let dist = distance as f32;

    // Binary search for bracket
    let mut lo: usize = 0;
    let mut hi: usize = world_points.len() - 1;
    while lo < hi.saturating_sub(1) {
        let mid = (lo + hi) / 2;
        if world_points[mid].distance <= dist {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    let pa = &world_points[lo];
    let pb = &world_points[hi];
    let seg_len = pb.distance - pa.distance;

    let t = if seg_len > 0.0 {
        ((dist - pa.distance) / seg_len).clamp(0.0, 1.0) as f64
    } else {
        0.0
    };

    let x = pa.x + (pb.x - pa.x) * t;
    let y = pa.y + (pb.y - pa.y) * t;
    let heading = (pb.y - pa.y).atan2(pb.x - pa.x);

    Ok(Some(CursorPosition { x, y, heading }))
}

// ─── B4: generate_offset_boundaries ─────────────────────────
// Offset perpendiculars from track centerline.

#[command]
pub async fn generate_offset_boundaries(
    world_points: Vec<WorldPoint>,
    offset: f64,
) -> Result<OffsetBoundaries, String> {
    if world_points.len() < 2 {
        return Ok(OffsetBoundaries {
            left: vec![],
            right: vec![],
        });
    }

    // Subsample every 3 points
    let mut subsampled: Vec<&WorldPoint> = Vec::new();
    for i in (0..world_points.len()).step_by(3) {
        subsampled.push(&world_points[i]);
    }
    if let Some(last) = world_points.last() {
        if !std::ptr::eq(*subsampled.last().unwrap(), last) {
            subsampled.push(last);
        }
    }

    let mut left = Vec::with_capacity(subsampled.len());
    let mut right = Vec::with_capacity(subsampled.len());

    for i in 0..subsampled.len() {
        let (dx, dy) = if i == 0 {
            (subsampled[1].x - subsampled[0].x, subsampled[1].y - subsampled[0].y)
        } else if i == subsampled.len() - 1 {
            (subsampled[i].x - subsampled[i - 1].x, subsampled[i].y - subsampled[i - 1].y)
        } else {
            (
                (subsampled[i + 1].x - subsampled[i - 1].x) / 2.0,
                (subsampled[i + 1].y - subsampled[i - 1].y) / 2.0,
            )
        };

        let length = (dx * dx + dy * dy).sqrt();
        if length == 0.0 {
            continue;
        }

        let perp_x = -dy / length;
        let perp_y = dx / length;

        left.push(Point2D {
            x: subsampled[i].x + perp_x * offset,
            y: subsampled[i].y + perp_y * offset,
        });
        right.push(Point2D {
            x: subsampled[i].x - perp_x * offset,
            y: subsampled[i].y - perp_y * offset,
        });
    }

    Ok(OffsetBoundaries { left, right })
}

// ─── B5: transform_envelope_points ──────────────────────────
// Transforms envelope boundary points from geo coords to SVG world coords.

#[command]
pub async fn transform_envelope_points(
    points: Vec<crate::models::TrackBoundaryPoint>,
    min_lon: f64,
    min_lat: f64,
    max_lat: f64,
    _canvas_width: f64,
    canvas_height: f64,
    _padding: f64,
    scale: f64,
    offset_x: f64,
    offset_y: f64,
) -> Result<EnvelopeWorldPoints, String> {
    let avg_lat = (min_lat + max_lat) / 2.0;
    let lat_correction = (avg_lat * std::f64::consts::PI / 180.0).cos();

    let geo_to_svg = |lon: f64, lat: f64| -> Point2D {
        let x = (lon - min_lon) * lat_correction * scale + offset_x;
        let y = canvas_height - offset_y - (lat - min_lat) * scale;
        Point2D { x, y }
    };

    let mut inner = Vec::with_capacity(points.len());
    let mut outer = Vec::with_capacity(points.len());
    let mut center = Vec::with_capacity(points.len());

    for p in &points {
        inner.push(geo_to_svg(p.min_x as f64, p.min_y as f64));
        outer.push(geo_to_svg(p.max_x as f64, p.max_y as f64));
        center.push(geo_to_svg(p.center_x as f64, p.center_y as f64));
    }

    Ok(EnvelopeWorldPoints { inner, outer, center })
}
