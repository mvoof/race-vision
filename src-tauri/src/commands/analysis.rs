use crate::models::{Corner, TrajectoryPoint};
use tauri::command;

#[command]
pub async fn analyze_corners(trajectory: Vec<TrajectoryPoint>) -> Result<Vec<Corner>, String> {
    if trajectory.len() < 10 {
        return Ok(Vec::new());
    }

    // Calculate curvatures using Menger curvature formula
    let curvatures = calculate_curvatures(&trajectory);
    let mut corners = Vec::new();
    
    // Threshold for detecting a corner (tunable)
    let curvature_threshold = 0.005; 
    let mut in_corner = false;
    let mut start_index = 0;

    // Iterate through points to find segments with high curvature
    for i in 2..curvatures.len() - 2 {
        let is_above = curvatures[i] > curvature_threshold;

        if is_above && !in_corner {
            in_corner = true;
            start_index = i;
        } else if !is_above && in_corner {
            in_corner = false;
            let end_index = i;

            // Filter out noise (very short corners)
            if end_index - start_index > 5 {
                 let corner = process_corner(&trajectory, start_index, end_index, (corners.len() + 1) as u32);
                 corners.push(corner);
            }
        }
    }

    Ok(corners)
}

fn calculate_curvatures(trajectory: &[TrajectoryPoint]) -> Vec<f32> {
    let mut curvatures = vec![0.0; trajectory.len()];

    for i in 1..trajectory.len() - 1 {
        let p1 = &trajectory[i - 1];
        let p2 = &trajectory[i];
        let p3 = &trajectory[i + 1];

        // Menger curvature: 4 * Area / (d1 * d2 * d3)
        // Area of triangle formed by p1, p2, p3
        let area = 0.5 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)).abs();
        
        let d12 = ((p2.x - p1.x).powi(2) + (p2.y - p1.y).powi(2)).sqrt();
        let d23 = ((p3.x - p2.x).powi(2) + (p3.y - p2.y).powi(2)).sqrt();
        let d31 = ((p1.x - p3.x).powi(2) + (p1.y - p3.y).powi(2)).sqrt();

        if d12 * d23 * d31 > 0.0 {
            curvatures[i] = (4.0 * area) / (d12 * d23 * d31);
        }
    }

    curvatures
}

fn process_corner(trajectory: &[TrajectoryPoint], start_index: usize, end_index: usize, id: u32) -> Corner {
    let mut apex_index = start_index;
    let mut min_speed = trajectory[start_index].speed;
    
    // Find point of minimum speed (Apex)
    for i in start_index..=end_index {
        if trajectory[i].speed < min_speed {
            min_speed = trajectory[i].speed;
            apex_index = i;
        }
    }

    // Determine turn direction using cross product of entry and exit vectors
    let entry_vec_x = trajectory[start_index + 2].x - trajectory[start_index].x;
    let entry_vec_y = trajectory[start_index + 2].y - trajectory[start_index].y;
    
    let exit_vec_x = trajectory[end_index].x - trajectory[end_index - 2].x;
    let exit_vec_y = trajectory[end_index].y - trajectory[end_index - 2].y;

    let cross_product = entry_vec_x * exit_vec_y - entry_vec_y * exit_vec_x;
    let turn_direction = if cross_product > 0.0 { "right".to_string() } else { "left".to_string() };

    // Placeholder for max curvature if needed later
    let max_curvature = 0.0;

    Corner {
        id,
        name: format!("T{}", id),
        start_index,
        end_index,
        apex_index,
        min_speed,
        entry_speed: trajectory[start_index].speed,
        exit_speed: trajectory[end_index].speed,
        turn_direction,
        max_curvature
    }
}
