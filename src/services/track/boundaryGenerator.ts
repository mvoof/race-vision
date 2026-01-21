/**
 * Track boundary generator using Frenet coordinate system
 *
 * Generates track boundaries from telemetry data by:
 * 1. Creating a reference line from the fastest lap
 * 2. Converting all trajectory points to Frenet coordinates (s, d)
 * 3. Finding min/max d values per segment to determine boundaries
 */

import {
  createReferenceLine,
  toFrenet,
  fromFrenet,
  type Point2D,
  type FrenetPoint,
  type ReferenceLine,
} from './frenetTransform';

/**
 * A segment of track with boundary information
 */
export interface BoundarySegment {
  s: number; // Position on track (meters from start)
  dLeft: number; // Left boundary deviation (positive)
  dRight: number; // Right boundary deviation (negative)
  samples: number; // Number of data points in this segment
}

/**
 * Generated boundary data for a track
 */
export interface ComputedTrackBoundary {
  trackName: string;
  trackLayout: string;
  referenceLine: ReferenceLine;
  segments: BoundarySegment[];
  leftBoundary: Point2D[];
  rightBoundary: Point2D[];
  totalLaps: number;
  updatedAt: string;
}

/**
 * Options for boundary generation
 */
export interface BoundaryGeneratorOptions {
  segmentSize: number; // Size of each segment in meters (default: 5)
  fallbackWidth: number; // Fallback half-width if no data (default: 6m each side = 12m total)
  smoothWindow: number; // Smoothing window for reference line
  minSamplesPerSegment: number; // Minimum samples to trust boundary (default: 3)
  outlierThreshold: number; // Ignore points > this deviation (default: 15m)
}

const DEFAULT_OPTIONS: BoundaryGeneratorOptions = {
  segmentSize: 5,
  fallbackWidth: 6,
  smoothWindow: 5,
  minSamplesPerSegment: 3,
  outlierThreshold: 15,
};

/**
 * Generate boundaries from multiple trajectory laps
 *
 * @param trajectories Array of trajectory arrays (each is a lap)
 * @param trackName Name of the track
 * @param trackLayout Layout variant
 * @param options Generation options
 */
export function generateBoundariesFromTrajectories(
  trajectories: Point2D[][],
  trackName: string,
  trackLayout: string = '',
  options: Partial<BoundaryGeneratorOptions> = {}
): ComputedTrackBoundary | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (trajectories.length === 0) {
    return null;
  }

  // Find the longest trajectory to use as reference (usually fastest lap)
  // Alternatively, could use average or first lap
  let longestIdx = 0;
  let longestLen = 0;
  for (let i = 0; i < trajectories.length; i++) {
    if (trajectories[i].length > longestLen) {
      longestLen = trajectories[i].length;
      longestIdx = i;
    }
  }

  const referenceTrajectory = trajectories[longestIdx];

  if (referenceTrajectory.length < 10) {
    return null;
  }

  // Create reference line
  const referenceLine = createReferenceLine(
    referenceTrajectory,
    opts.smoothWindow,
    opts.segmentSize / 2 // Resample at half segment size for smoother line
  );

  if (referenceLine.points.length < 2) {
    return null;
  }

  // Calculate number of segments
  const numSegments = Math.ceil(referenceLine.totalLength / opts.segmentSize);

  // Initialize segment data
  const segmentData: { dValues: number[]; s: number }[] = [];
  for (let i = 0; i < numSegments; i++) {
    segmentData.push({
      s: i * opts.segmentSize + opts.segmentSize / 2,
      dValues: [],
    });
  }

  // Process all trajectories
  for (const trajectory of trajectories) {
    for (const point of trajectory) {
      const frenet = toFrenet(point, referenceLine);

      // Skip outliers
      if (Math.abs(frenet.d) > opts.outlierThreshold) {
        continue;
      }

      // Find segment
      const segmentIdx = Math.min(
        Math.floor(frenet.s / opts.segmentSize),
        numSegments - 1
      );

      if (segmentIdx >= 0 && segmentIdx < segmentData.length) {
        segmentData[segmentIdx].dValues.push(frenet.d);
      }
    }
  }

  // Calculate boundaries per segment
  const segments: BoundarySegment[] = segmentData.map((data, idx) => {
    const s = idx * opts.segmentSize + opts.segmentSize / 2;
    const samples = data.dValues.length;

    if (samples < opts.minSamplesPerSegment) {
      // Not enough data, use fallback width
      return {
        s,
        dLeft: opts.fallbackWidth,
        dRight: -opts.fallbackWidth,
        samples,
      };
    }

    // Sort values to find percentiles (more robust than min/max)
    const sorted = [...data.dValues].sort((a, b) => a - b);

    // Use 5th and 95th percentile to avoid outliers
    const lowIdx = Math.floor(sorted.length * 0.05);
    const highIdx = Math.floor(sorted.length * 0.95);

    const dRight = sorted[lowIdx]; // Most negative (right boundary)
    const dLeft = sorted[highIdx]; // Most positive (left boundary)

    // Ensure minimum width
    const minHalfWidth = 3; // At least 3m on each side
    const finalDLeft = Math.max(dLeft, minHalfWidth);
    const finalDRight = Math.min(dRight, -minHalfWidth);

    return {
      s,
      dLeft: finalDLeft,
      dRight: finalDRight,
      samples,
    };
  });

  // Smooth boundaries
  const smoothedSegments = smoothBoundarySegments(segments);

  // Generate boundary polylines
  const leftBoundary = smoothedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dLeft }, referenceLine)
  );

  const rightBoundary = smoothedSegments.map((seg) =>
    fromFrenet({ s: seg.s, d: seg.dRight }, referenceLine)
  );

  return {
    trackName,
    trackLayout,
    referenceLine,
    segments: smoothedSegments,
    leftBoundary,
    rightBoundary,
    totalLaps: trajectories.length,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Smooth boundary segments to reduce jaggedness
 */
function smoothBoundarySegments(
  segments: BoundarySegment[],
  windowSize: number = 3
): BoundarySegment[] {
  if (segments.length < windowSize) {
    return segments;
  }

  const halfWindow = Math.floor(windowSize / 2);
  const smoothed: BoundarySegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    let sumLeft = 0;
    let sumRight = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(segments.length - 1, i + halfWindow);
      j++
    ) {
      sumLeft += segments[j].dLeft;
      sumRight += segments[j].dRight;
      count++;
    }

    smoothed.push({
      s: segments[i].s,
      dLeft: sumLeft / count,
      dRight: sumRight / count,
      samples: segments[i].samples,
    });
  }

  return smoothed;
}

/**
 * Generate offset boundary from a single trajectory
 * Uses a fixed offset distance on each side (simpler fallback)
 *
 * @param trajectory Single lap trajectory
 * @param offsetDistance Distance from centerline (default 6m)
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
 *
 * @param autoBoundary Auto-generated boundary
 * @param manualBoundary Manually recorded boundary (from Track Walk)
 * @returns Merged boundary preferring manual data where available
 */
export function mergeBoundaries(
  autoBoundary: ComputedTrackBoundary,
  manualBoundary: ComputedTrackBoundary
): ComputedTrackBoundary {
  // Use manual reference line as it's more accurate from Track Walk
  const referenceLine = manualBoundary.referenceLine;

  // Merge segments - prefer manual where it has sufficient samples
  const mergedSegments: BoundarySegment[] = [];

  for (let i = 0; i < autoBoundary.segments.length; i++) {
    const autoSeg = autoBoundary.segments[i];

    // Find corresponding manual segment
    const manualSeg = manualBoundary.segments.find(
      (s) => Math.abs(s.s - autoSeg.s) < autoBoundary.segments[0].s
    );

    if (manualSeg && manualSeg.samples > 0) {
      // Use manual boundary
      mergedSegments.push(manualSeg);
    } else {
      // Use auto boundary
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
 * Add new trajectory data to existing boundary (incremental update)
 */
export function addTrajectoryToBoundary(
  existingBoundary: ComputedTrackBoundary,
  newTrajectory: Point2D[],
  options: Partial<BoundaryGeneratorOptions> = {}
): ComputedTrackBoundary {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { referenceLine, segments } = existingBoundary;

  // Convert new trajectory to Frenet coordinates
  const frenetPoints: FrenetPoint[] = [];
  for (const point of newTrajectory) {
    const frenet = toFrenet(point, referenceLine);
    if (Math.abs(frenet.d) <= opts.outlierThreshold) {
      frenetPoints.push(frenet);
    }
  }

  // Update segments with new data
  const updatedSegments = segments.map((seg) => {
    const newDValues: number[] = [];

    for (const f of frenetPoints) {
      const segmentIdx = Math.floor(f.s / opts.segmentSize);
      if (
        Math.abs(segmentIdx * opts.segmentSize + opts.segmentSize / 2 - seg.s) <
        opts.segmentSize / 2
      ) {
        newDValues.push(f.d);
      }
    }

    if (newDValues.length === 0) {
      return seg;
    }

    // Weighted update of boundaries
    const totalSamples = seg.samples + newDValues.length;
    const newMin = Math.min(...newDValues);
    const newMax = Math.max(...newDValues);

    // Expand boundaries if new data is outside current bounds
    const dLeft = Math.max(seg.dLeft, newMax);
    const dRight = Math.min(seg.dRight, newMin);

    return {
      s: seg.s,
      dLeft,
      dRight,
      samples: totalSamples,
    };
  });

  // Regenerate polylines
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

/**
 * Check if boundary has sufficient data quality
 */
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
