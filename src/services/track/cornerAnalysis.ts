import { analyzeCorners as analyzeCornersRust } from '../tauri/commands';
import type { TrajectoryPoint, Corner } from '../../types';

/**
 * Detects corners in a trajectory.
 * Now proxies to Rust backend.
 */
export async function detectCorners(
  trajectory: TrajectoryPoint[]
): Promise<Corner[]> {
  return analyzeCornersRust(trajectory);
}

export type { Corner };
