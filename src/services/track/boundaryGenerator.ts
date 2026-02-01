import { generateBoundaries } from '../tauri/commands';
import type {
  ComputedTrackBoundary,
  BoundaryGeneratorOptions,
  BoundarySegment,
  Point2D,
  ReferenceLine,
} from '../../types';
import {
  createReferenceLine,
  toFrenet,
  fromFrenet,
} from './frenetTransform';

/**
 * Generate boundaries from multiple trajectory laps using Rust backend
 */
export async function generateBoundariesFromTrajectories(
  trajectories: Point2D[][],
  trackName: string,
  trackLayout: string = '',
  options: Partial<BoundaryGeneratorOptions> = {}
): Promise<ComputedTrackBoundary | null> {
  return generateBoundaries(trajectories, trackName, trackLayout, options);
}

/**
 * Generate offset boundary from a single trajectory (Client-side fallback/simple mode)
 */
export function generateOffsetBoundary(
  trajectory: Point2D[],
  trackName: string,
  trackLayout: string = '',
  offsetDistance: number = 6
): ComputedTrackBoundary | null {
  if (trajectory.length < 10) {
    return null;
  }

  const referenceLine = createReferenceLine(trajectory, 5, 2);

  if (referenceLine.points.length < 2) {
    return null;
  }

  // Generate boundaries at fixed offset
  const segmentSize = 5;
  const numSegments = Math.ceil(referenceLine.totalLength / segmentSize);

  const segments: BoundarySegment[] = [];
  const leftBoundary: Point2D[] = [];
  const rightBoundary: Point2D[] = [];

  for (let i = 0; i < numSegments; i++) {
    const s = i * segmentSize + segmentSize / 2;

    segments.push({
      s,
      dLeft: offsetDistance,
      dRight: -offsetDistance,
      samples: 1,
    });

    leftBoundary.push(fromFrenet({ s, d: offsetDistance }, referenceLine));
    rightBoundary.push(fromFrenet({ s, d: -offsetDistance }, referenceLine));
  }

  return {
    trackName,
    trackLayout,
    referenceLine,
    segments,
    leftBoundary,
    rightBoundary,
    totalLaps: 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge auto-generated boundaries with manually recorded Track Walk boundaries
 */
export function mergeBoundaries(
  autoBoundary: ComputedTrackBoundary,
  manualBoundary: ComputedTrackBoundary
): ComputedTrackBoundary {
  // Use manual reference line as it's more accurate from Track Walk
  const referenceLine = manualBoundary.referenceLine;

  // Merge segments - prefer manual where it has sufficient samples
  const mergedSegments: BoundarySegment[] = [];

  // Note: This logic assumes roughly same reference line. 
  // In a robust system, we would re-project auto segments onto manual reference line.
  // For now, we trust the segments align by 's' coordinate if generated from same source.
  
  for (let i = 0; i < autoBoundary.segments.length; i++) {
    const autoSeg = autoBoundary.segments[i];

    // Find corresponding manual segment
    const manualSeg = manualBoundary.segments.find(
      (s) => Math.abs(s.s - autoSeg.s) < autoBoundary.segments[0].s
    );

    if (manualSeg && manualSeg.samples > 0) {
      mergedSegments.push(manualSeg);
    } else {
      mergedSegments.push(autoSeg);
    }
  }

  // Regenerate polylines from merged segments
  const leftBoundary = mergedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dLeft }, referenceLine)
  );

  const rightBoundary = mergedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dRight }, referenceLine)
  );

  return {
    trackName: autoBoundary.trackName,
    trackLayout: autoBoundary.trackLayout,
    referenceLine,
    segments: mergedSegments,
    leftBoundary,
    rightBoundary,
    totalLaps: autoBoundary.totalLaps + manualBoundary.totalLaps,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add new trajectory data to existing boundary
 * REFACTORED: Now just re-calls the full generation if possible, 
 * or uses client side logic if needed. 
 * For simplicity and robustness, we encourage re-generation.
 * But providing client-side fallback here if full re-gen is too expensive (unlikely with Rust).
 */
export function addTrajectoryToBoundary(
  existingBoundary: ComputedTrackBoundary,
  newTrajectory: Point2D[],
  options: Partial<BoundaryGeneratorOptions> = {}
): ComputedTrackBoundary {
  // Client-side implementation for quick incremental updates without backend trip
  // (simplified version of previous logic)
  
  const opts = { 
    segmentSize: 5,
    outlierThreshold: 15,
     ...options 
  };
  const { referenceLine, segments } = existingBoundary;

  const frenetPoints = [];
  for (const point of newTrajectory) {
    const frenet = toFrenet(point, referenceLine);
    if (Math.abs(frenet.d) <= opts.outlierThreshold) {
      frenetPoints.push(frenet);
    }
  }

  const updatedSegments = segments.map((seg) => {
    const newDValues: number[] = [];

    for (const f of frenetPoints) {
      // Simple segment finding
      const segStart = seg.s - opts.segmentSize / 2;
      const segEnd = seg.s + opts.segmentSize / 2;
      
      if (f.s >= segStart && f.s < segEnd) {
        newDValues.push(f.d);
      }
    }

    if (newDValues.length === 0) {
      return seg;
    }

    const newMin = Math.min(...newDValues);
    const newMax = Math.max(...newDValues);
    const dLeft = Math.max(seg.dLeft, newMax);
    const dRight = Math.min(seg.dRight, newMin);

    return {
      s: seg.s,
      dLeft,
      dRight,
      samples: seg.samples + newDValues.length,
    };
  });

  const leftBoundary = updatedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dLeft }, referenceLine)
  );

  const rightBoundary = updatedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dRight }, referenceLine)
  );

  return {
    ...existingBoundary,
    segments: updatedSegments,
    leftBoundary,
    rightBoundary,
    totalLaps: existingBoundary.totalLaps + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function isBoundaryQualitySufficient(
  boundary: ComputedTrackBoundary,
  minSegmentCoverage: number = 0.8,
  minSamplesPerSegment: number = 3
): boolean {
  const sufficientSegments = boundary.segments.filter(
    (s) => s.samples >= minSamplesPerSegment
  ).length;

  return sufficientSegments / boundary.segments.length >= minSegmentCoverage;
}