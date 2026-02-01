use crate::models::track::{
    BoundaryGeneratorOptions, BoundarySegment, ComputedTrackBoundary, Point2D, ReferenceLine, ReferenceLinePoint,
};
use tauri::command;

#[derive(Debug)]
struct FrenetPoint {
    s: f32,
    d: f32,
}

#[command]
pub async fn generate_boundaries(
    trajectories: Vec<Vec<Point2D>>,
    track_name: String,
    track_layout: Option<String>,
    options: Option<BoundaryGeneratorOptions>,
) -> Result<Option<ComputedTrackBoundary>, String> {
    let opts = options.unwrap_or_default();

    if trajectories.is_empty() {
        return Ok(None);
    }

    // Find longest trajectory for reference
    let mut longest_idx = 0;
    let mut longest_len = 0;
    for (i, t) in trajectories.iter().enumerate() {
        if t.len() > longest_len {
            longest_len = t.len();
            longest_idx = i;
        }
    }

    let reference_trajectory = &trajectories[longest_idx];
    if reference_trajectory.len() < 10 {
        return Ok(None);
    }

    // Create reference line
    let reference_line = create_reference_line(
        reference_trajectory,
        opts.smooth_window,
        opts.segment_size / 2.0,
    );

    if reference_line.points.len() < 2 {
        return Ok(None);
    }

    // Initialize segments
    let num_segments = (reference_line.total_length / opts.segment_size).ceil() as usize;
    let mut segment_d_values: Vec<Vec<f32>> = vec![Vec::new(); num_segments];

    // Process all trajectories
    for trajectory in &trajectories {
        for point in trajectory {
            let frenet = to_frenet(point, &reference_line);
            
            if frenet.d.abs() > opts.outlier_threshold {
                continue;
            }

            let segment_idx = (frenet.s / opts.segment_size).floor() as usize;
            let segment_idx = segment_idx.min(num_segments - 1); // Clamp

            segment_d_values[segment_idx].push(frenet.d);
        }
    }

    // Calculate boundaries
    let mut segments = Vec::new();
    for (i, d_values) in segment_d_values.iter().enumerate() {
        let s = (i as f32) * opts.segment_size + opts.segment_size / 2.0;
        let samples = d_values.len() as u32;

        let (d_left, d_right) = if samples < opts.min_samples_per_segment {
            (opts.fallback_width, -opts.fallback_width)
        } else {
            let mut sorted = d_values.clone();
            // Floats don't impl Ord, so we use partial_cmp
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

            let low_idx = (sorted.len() as f32 * 0.05).floor() as usize;
            let high_idx = (sorted.len() as f32 * 0.95).floor() as usize;
            
            // Clamp indices
            let low_idx = low_idx.clamp(0, sorted.len().saturating_sub(1));
            let high_idx = high_idx.clamp(0, sorted.len().saturating_sub(1));

            let d_right = sorted[low_idx];
            let d_left = sorted[high_idx];

            let min_half_width = 3.0;
            (d_left.max(min_half_width), d_right.min(-min_half_width))
        };

        segments.push(BoundarySegment {
            s,
            d_left,
            d_right,
            samples,
        });
    }

    // Smooth boundaries
    let smoothed_segments = smooth_boundary_segments(&segments, 3);

    // Generate polylines
    let left_boundary: Vec<Point2D> = smoothed_segments
        .iter()
        .map(|seg| from_frenet(seg.s, seg.d_left, &reference_line))
        .collect();

    let right_boundary: Vec<Point2D> = smoothed_segments
        .iter()
        .map(|seg| from_frenet(seg.s, seg.d_right, &reference_line))
        .collect();

    Ok(Some(ComputedTrackBoundary {
        track_name,
        track_layout: track_layout.unwrap_or_default(),
        reference_line,
        segments: smoothed_segments,
        left_boundary,
        right_boundary,
        total_laps: trajectories.len() as u32,
        updated_at: chrono::Utc::now().to_rfc3339(),
    }))
}

// --- Helpers ---

fn create_reference_line(
    points: &[Point2D],
    smooth_window: usize,
    sample_distance: f32,
) -> ReferenceLine {
    // 1. Smooth points (Simple Moving Average)
    let smoothed: Vec<Point2D> = if points.len() < smooth_window {
        points.to_vec()
    } else {
        let half_window = smooth_window / 2;
        let mut res = Vec::new();
        for i in 0..points.len() {
            let start = i.saturating_sub(half_window);
            let end = (i + half_window).min(points.len() - 1);
            let count = (end - start + 1) as f32;
            
            let mut sum_x = 0.0;
            let mut sum_y = 0.0;
            for p in &points[start..=end] {
                sum_x += p.x;
                sum_y += p.y;
            }
            res.push(Point2D { x: sum_x / count, y: sum_y / count });
        }
        res
    };

    // 2. Calculate cumulative distance
    let mut total_dist = 0.0;
    let mut cumul_dist = vec![0.0];
    for i in 1..smoothed.len() {
        let d = dist(&smoothed[i], &smoothed[i-1]);
        total_dist += d;
        cumul_dist.push(total_dist);
    }

    // 3. Resample at fixed distance
    let num_points = (total_dist / sample_distance).ceil() as usize;
    let mut final_points: Vec<ReferenceLinePoint> = Vec::new();
    
    for i in 0..=num_points {
        let target_dist = (i as f32) * sample_distance;
        if target_dist > total_dist { break; }

        let idx = match cumul_dist.binary_search_by(|d| d.partial_cmp(&target_dist).unwrap()) {
            Ok(i) => i,
            Err(i) => i.saturating_sub(1),
        };

        let pt = if idx >= smoothed.len() - 1 {
            smoothed.last().unwrap().clone()
        } else {
            let p1 = &smoothed[idx];
            let p2 = &smoothed[idx+1];
            let d1 = cumul_dist[idx];
            let d2 = cumul_dist[idx+1];
            let segment_len = d2 - d1;
            
            if segment_len > 0.0001 {
                let t = (target_dist - d1) / segment_len;
                Point2D {
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t,
                }
            } else {
                 p1.clone()
            }
        };

        // Calculate heading (tangent)
        // Look ahead a bit for smoothness? Or just adjacent points?
        // Let's use simple next point (or previous if last)
        let heading = 0.0; // Placeholder, calculated below
        
        final_points.push(ReferenceLinePoint {
            x: pt.x,
            y: pt.y,
            s: target_dist,
            heading,
        });
    }

    // Calculate headings properly now that we have uniform points
    for i in 0..final_points.len() {
        let p_prev = if i > 0 { &final_points[i-1] } else { &final_points[i] };
        let p_next = if i < final_points.len() - 1 { &final_points[i+1] } else { &final_points[i] };
        
        // Use centered difference if possible
        let (dx, dy) = if i > 0 && i < final_points.len() - 1 {
            (p_next.x - p_prev.x, p_next.y - p_prev.y)
        } else if i == 0 {
             (p_next.x - final_points[i].x, p_next.y - final_points[i].y)
        } else {
             (final_points[i].x - p_prev.x, final_points[i].y - p_prev.y)
        };

        final_points[i].heading = dy.atan2(dx);
    }

    ReferenceLine {
        points: final_points,
        total_length: total_dist,
    }
}

fn to_frenet(point: &Point2D, line: &ReferenceLine) -> FrenetPoint {
    // Find closest point on polyline
    let mut min_dist_sq = f32::MAX;
    let mut closest_idx = 0;

    for (i, p) in line.points.iter().enumerate() {
        let d_sq = (p.x - point.x).powi(2) + (p.y - point.y).powi(2);
        if d_sq < min_dist_sq {
            min_dist_sq = d_sq;
            closest_idx = i;
        }
    }

    let idx = closest_idx;
    let p_close = &line.points[idx];
    
    // Determine sign of d (cross product)
    let (p_prev, p_next) = if idx == 0 {
        (p_close, line.points.get(1).unwrap_or(p_close))
    } else if idx == line.points.len() - 1 {
         (&line.points[idx-1], p_close)
    } else {
        (&line.points[idx-1], &line.points[idx+1])
    };
    
    let tangent_x = p_next.x - p_prev.x;
    let tangent_y = p_next.y - p_prev.y;
    
    let dx = point.x - p_close.x;
    let dy = point.y - p_close.y;
    
    let cross = tangent_x * dy - tangent_y * dx;
    let sign = if cross > 0.0 { 1.0 } else { -1.0 };
    
    FrenetPoint {
        s: p_close.s, 
        d: min_dist_sq.sqrt() * sign,
    }
}

fn from_frenet(s: f32, d: f32, line: &ReferenceLine) -> Point2D {
    // Find segment for 's'
    let idx = match line.points.binary_search_by(|p| p.s.partial_cmp(&s).unwrap()) {
        Ok(i) => i,
        Err(i) => i.saturating_sub(1),
    };
    
    let idx = idx.min(line.points.len().saturating_sub(2));
    
    if line.points.is_empty() { return Point2D{x:0.0, y:0.0}; }
    if idx >= line.points.len() - 1 { 
        let last = line.points.last().unwrap();
        return Point2D{x: last.x, y: last.y}; 
    }
    
    let p1 = &line.points[idx];
    let p2 = &line.points[idx+1];
    
    let seg_len = p2.s - p1.s;
    let t = if seg_len > 0.0001 { (s - p1.s) / seg_len } else { 0.0 };
    
    let px = p1.x + (p2.x - p1.x) * t;
    let py = p1.y + (p2.y - p1.y) * t;
    
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len = (dx*dx + dy*dy).sqrt();
    
    let (nx, ny) = if len > 0.0001 {
        (-dy / len, dx / len) 
    } else {
        (0.0, 1.0)
    };
    
    Point2D {
        x: px + nx * d,
        y: py + ny * d,
    }
}

fn smooth_boundary_segments(segments: &[BoundarySegment], window_size: usize) -> Vec<BoundarySegment> {
    if segments.len() < window_size {
        return segments.to_vec();
    }

    let half_window = window_size / 2;
    let mut smoothed = Vec::with_capacity(segments.len());

    for i in 0..segments.len() {
        let start = i.saturating_sub(half_window);
        let end = (i + half_window).min(segments.len() - 1);
        let count = (end - start + 1) as f32;

        let mut sum_left = 0.0;
        let mut sum_right = 0.0;
        
        for seg in &segments[start..=end] {
            sum_left += seg.d_left;
            sum_right += seg.d_right;
        }

        smoothed.push(BoundarySegment {
            s: segments[i].s,
            d_left: sum_left / count,
            d_right: sum_right / count,
            samples: segments[i].samples,
        });
    }
    smoothed
}

fn dist(p1: &Point2D, p2: &Point2D) -> f32 {
    ((p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2)).sqrt()
}