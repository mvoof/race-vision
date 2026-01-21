/**
 * Frenet coordinate system transformations for track boundary generation
 *
 * Frenet coordinates (s, d):
 * - s: distance along the reference line (track centerline)
 * - d: perpendicular deviation from the reference line (+ left, - right)
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface FrenetPoint {
  s: number; // Distance along reference line
  d: number; // Perpendicular deviation (+ left, - right)
}

export interface ReferenceLinePoint extends Point2D {
  s: number; // Cumulative distance from start
  heading: number; // Direction angle in radians
}

export interface ReferenceLine {
  points: ReferenceLinePoint[];
  totalLength: number;
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate heading angle from p1 to p2
 */
function heading(p1: Point2D, p2: Point2D): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Normalize angle to [-PI, PI]
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Apply Savitzky-Golay-like smoothing (simple moving average for now)
 */
function smoothPoints(points: Point2D[], windowSize: number = 5): Point2D[] {
  if (points.length < windowSize) return points;

  const halfWindow = Math.floor(windowSize / 2);
  const smoothed: Point2D[] = [];

  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(points.length - 1, i + halfWindow);
      j++
    ) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }

    smoothed.push({
      x: sumX / count,
      y: sumY / count,
    });
  }

  return smoothed;
}

/**
 * Resample points to have uniform spacing
 */
function resamplePoints(points: Point2D[], targetSpacing: number): Point2D[] {
  if (points.length < 2) return points;

  const resampled: Point2D[] = [points[0]];
  let accumulatedDist = 0;
  let lastAddedIdx = 0;

  for (let i = 1; i < points.length; i++) {
    const segmentDist = distance(points[i - 1], points[i]);
    accumulatedDist += segmentDist;

    while (accumulatedDist >= targetSpacing) {
      // Interpolate point at targetSpacing distance
      const overshoot = accumulatedDist - targetSpacing;
      const ratio = 1 - overshoot / segmentDist;

      const newPoint: Point2D = {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
      };

      resampled.push(newPoint);
      accumulatedDist = overshoot;
      lastAddedIdx = i;
    }
  }

  // Add last point if not already added
  if (lastAddedIdx < points.length - 1) {
    resampled.push(points[points.length - 1]);
  }

  return resampled;
}

/**
 * Create a reference line from trajectory points
 *
 * @param trajectory Raw trajectory points
 * @param smoothWindow Smoothing window size
 * @param resampleSpacing Target spacing between points (meters)
 */
export function createReferenceLine(
  trajectory: Point2D[],
  smoothWindow: number = 5,
  resampleSpacing: number = 2
): ReferenceLine {
  if (trajectory.length < 2) {
    return { points: [], totalLength: 0 };
  }

  // Step 1: Smooth the trajectory
  const smoothed = smoothPoints(trajectory, smoothWindow);

  // Step 2: Resample to uniform spacing
  const resampled = resamplePoints(smoothed, resampleSpacing);

  // Step 3: Calculate cumulative distance and heading for each point
  const points: ReferenceLinePoint[] = [];
  let cumulativeDist = 0;

  for (let i = 0; i < resampled.length; i++) {
    const p = resampled[i];

    // Calculate heading (direction at this point)
    let h: number;
    if (i === 0) {
      h = heading(resampled[0], resampled[1]);
    } else if (i === resampled.length - 1) {
      h = heading(resampled[i - 1], resampled[i]);
    } else {
      // Average of incoming and outgoing heading
      const h1 = heading(resampled[i - 1], resampled[i]);
      const h2 = heading(resampled[i], resampled[i + 1]);
      h = (h1 + h2) / 2;
    }

    points.push({
      x: p.x,
      y: p.y,
      s: cumulativeDist,
      heading: h,
    });

    if (i < resampled.length - 1) {
      cumulativeDist += distance(resampled[i], resampled[i + 1]);
    }
  }

  return {
    points,
    totalLength: cumulativeDist,
  };
}

/**
 * Find the closest point on the reference line to a given point
 *
 * @returns Index of the closest segment start point and the projection point
 */
function findClosestPointOnLine(
  point: Point2D,
  refLine: ReferenceLine
): {
  segmentIdx: number;
  projection: Point2D;
  projectionS: number;
  distance: number;
} {
  const { points } = refLine;

  if (points.length < 2) {
    return {
      segmentIdx: 0,
      projection: points[0] || { x: 0, y: 0 },
      projectionS: 0,
      distance: points[0] ? distance(point, points[0]) : 0,
    };
  }

  let bestSegmentIdx = 0;
  let bestProjection: Point2D = points[0];
  let bestS = 0;
  let bestDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Project point onto line segment p1-p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (segmentLength === 0) continue;

    // Parameter t for projection (0 = p1, 1 = p2)
    let t =
      ((point.x - p1.x) * dx + (point.y - p1.y) * dy) /
      (segmentLength * segmentLength);

    // Clamp to segment
    t = Math.max(0, Math.min(1, t));

    const projection: Point2D = {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    };

    const dist = distance(point, projection);

    if (dist < bestDist) {
      bestDist = dist;
      bestSegmentIdx = i;
      bestProjection = projection;
      bestS = p1.s + t * segmentLength;
    }
  }

  return {
    segmentIdx: bestSegmentIdx,
    projection: bestProjection,
    projectionS: bestS,
    distance: bestDist,
  };
}

/**
 * Calculate signed perpendicular distance
 * Positive = left of direction of travel, Negative = right
 */
function signedPerpDistance(
  point: Point2D,
  linePoint: Point2D,
  lineHeading: number
): number {
  const dx = point.x - linePoint.x;
  const dy = point.y - linePoint.y;

  // Normal vector (perpendicular to heading, pointing left)
  const normalX = -Math.sin(lineHeading);
  const normalY = Math.cos(lineHeading);

  // Dot product with normal gives signed distance
  return dx * normalX + dy * normalY;
}

/**
 * Convert Cartesian point to Frenet coordinates relative to reference line
 *
 * @param point Cartesian point to convert
 * @param refLine Reference line
 * @returns Frenet coordinates (s, d)
 */
export function toFrenet(point: Point2D, refLine: ReferenceLine): FrenetPoint {
  const { segmentIdx, projection, projectionS } = findClosestPointOnLine(
    point,
    refLine
  );

  // Get heading at projection point (interpolate between segment endpoints)
  const p1 = refLine.points[segmentIdx];
  const p2 = refLine.points[segmentIdx + 1] || p1;

  const segmentLength = distance(p1, p2);
  const t = segmentLength > 0 ? (projectionS - p1.s) / segmentLength : 0;

  // Interpolate heading
  let headingAtProjection: number;
  if (segmentLength > 0) {
    const h1 = p1.heading;
    const h2 = p2.heading;
    // Handle angle wrapping
    let diff = normalizeAngle(h2 - h1);
    headingAtProjection = h1 + t * diff;
  } else {
    headingAtProjection = p1.heading;
  }

  // Calculate signed perpendicular distance
  const d = signedPerpDistance(point, projection, headingAtProjection);

  return { s: projectionS, d };
}

/**
 * Convert Frenet coordinates to Cartesian point
 *
 * @param frenet Frenet coordinates (s, d)
 * @param refLine Reference line
 * @returns Cartesian point
 */
export function fromFrenet(
  frenet: FrenetPoint,
  refLine: ReferenceLine
): Point2D {
  const { s, d } = frenet;
  const { points, totalLength } = refLine;

  if (points.length < 2) {
    return points[0] || { x: 0, y: 0 };
  }

  // Clamp s to valid range
  const clampedS = Math.max(0, Math.min(totalLength, s));

  // Find segment containing this s value
  let segmentIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i + 1].s >= clampedS) {
      segmentIdx = i;
      break;
    }
    segmentIdx = i;
  }

  const p1 = points[segmentIdx];
  const p2 = points[segmentIdx + 1] || p1;

  // Interpolate position on reference line
  const segmentLength = distance(p1, p2);
  const t = segmentLength > 0 ? (clampedS - p1.s) / segmentLength : 0;

  const refPoint: Point2D = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };

  // Interpolate heading
  let headingAtS: number;
  if (segmentLength > 0) {
    const diff = normalizeAngle(p2.heading - p1.heading);
    headingAtS = p1.heading + t * diff;
  } else {
    headingAtS = p1.heading;
  }

  // Move perpendicular to heading by distance d
  // Left is positive d
  const normalX = -Math.sin(headingAtS);
  const normalY = Math.cos(headingAtS);

  return {
    x: refPoint.x + d * normalX,
    y: refPoint.y + d * normalY,
  };
}

/**
 * Interpolate point on reference line at given s distance
 */
export function interpolateAtDistance(
  refLine: ReferenceLine,
  s: number
): Point2D {
  return fromFrenet({ s, d: 0 }, refLine);
}

/**
 * Get heading (direction) at given s distance on reference line
 */
export function getHeadingAtDistance(
  refLine: ReferenceLine,
  s: number
): number {
  const { points, totalLength } = refLine;

  if (points.length < 2) {
    return 0;
  }

  const clampedS = Math.max(0, Math.min(totalLength, s));

  // Find segment
  let segmentIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i + 1].s >= clampedS) {
      segmentIdx = i;
      break;
    }
    segmentIdx = i;
  }

  const p1 = points[segmentIdx];
  const p2 = points[segmentIdx + 1] || p1;

  // Interpolate heading
  const segmentLength = distance(p1, p2);
  const t = segmentLength > 0 ? (clampedS - p1.s) / segmentLength : 0;

  const diff = normalizeAngle(p2.heading - p1.heading);
  return p1.heading + t * diff;
}

/**
 * Batch convert multiple points to Frenet coordinates
 */
export function toFrenetBatch(
  points: Point2D[],
  refLine: ReferenceLine
): FrenetPoint[] {
  return points.map((p) => toFrenet(p, refLine));
}

/**
 * Batch convert Frenet coordinates to Cartesian
 */
export function fromFrenetBatch(
  frenetPoints: FrenetPoint[],
  refLine: ReferenceLine
): Point2D[] {
  return frenetPoints.map((f) => fromFrenet(f, refLine));
}
