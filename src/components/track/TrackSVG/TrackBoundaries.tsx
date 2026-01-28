import { useMemo } from 'react';
import type { ComputedTrackBoundary, Point2D } from '../../../types';

interface TrackBoundariesProps {
  // Computed boundary data (from Frenet algorithm)
  computedBoundary?: ComputedTrackBoundary | null;
  // SVG points from trajectory (fallback for generating offset boundaries)
  svgPoints?: { x: number; y: number }[];
  // Visual options
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  style?: 'solid' | 'dashed';
  // Offset distance in SVG units for fallback boundaries
  offsetDistance?: number;
}

/**
 * Calculate perpendicular offset points from a polyline
 * This creates left and right boundary lines at a fixed distance
 * Used as fallback when no ComputedTrackBoundary is available
 */
function generateOffsetBoundaries(
  points: Point2D[],
  offset: number
): { left: Point2D[]; right: Point2D[] } {
  if (points.length < 2) {
    return { left: [], right: [] };
  }

  const left: Point2D[] = [];
  const right: Point2D[] = [];

  for (let i = 0; i < points.length; i++) {
    // Calculate direction vector
    let dx: number, dy: number;

    if (i === 0) {
      // First point: use direction to next point
      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;
    } else if (i === points.length - 1) {
      // Last point: use direction from previous point
      dx = points[i].x - points[i - 1].x;
      dy = points[i].y - points[i - 1].y;
    } else {
      // Middle points: average of incoming and outgoing directions
      const dx1 = points[i].x - points[i - 1].x;
      const dy1 = points[i].y - points[i - 1].y;
      const dx2 = points[i + 1].x - points[i].x;
      const dy2 = points[i + 1].y - points[i].y;
      dx = (dx1 + dx2) / 2;
      dy = (dy1 + dy2) / 2;
    }

    // Normalize direction
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) {
      // Skip degenerate points
      if (i > 0) {
        left.push(left[left.length - 1]);
        right.push(right[right.length - 1]);
      }
      continue;
    }

    const ndx = dx / length;
    const ndy = dy / length;

    // Perpendicular vector (rotate 90 degrees)
    // Left is perpendicular counter-clockwise
    const perpX = -ndy;
    const perpY = ndx;

    // Create offset points
    left.push({
      x: points[i].x + perpX * offset,
      y: points[i].y + perpY * offset,
    });

    right.push({
      x: points[i].x - perpX * offset,
      y: points[i].y - perpY * offset,
    });
  }

  return { left, right };
}

/**
 * Convert points array to SVG path string
 */
function pointsToPath(points: Point2D[]): string {
  if (points.length === 0) return '';

  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

export function TrackBoundaries({
  computedBoundary,
  svgPoints,
  strokeColor = '#ffffff',
  strokeWidth = 1,
  opacity = 0.7,
  style = 'solid',
  offsetDistance = 8,
}: TrackBoundariesProps) {
  // Generate boundaries: use computed (Frenet) if available, otherwise generate from svgPoints
  const boundaryPaths = useMemo(() => {
    // Option 1: Use Frenet-computed boundaries
    if (computedBoundary?.leftBoundary && computedBoundary?.rightBoundary) {
      return {
        left: pointsToPath(computedBoundary.leftBoundary),
        right: pointsToPath(computedBoundary.rightBoundary),
      };
    }

    // Option 2: Generate offset boundaries from trajectory points
    if (svgPoints && svgPoints.length >= 2) {
      // Subsample points for smoother boundaries (every 3rd point)
      const subsampled: Point2D[] = [];
      for (let i = 0; i < svgPoints.length; i += 3) {
        subsampled.push(svgPoints[i]);
      }
      // Always include last point
      if (
        subsampled[subsampled.length - 1] !== svgPoints[svgPoints.length - 1]
      ) {
        subsampled.push(svgPoints[svgPoints.length - 1]);
      }

      const { left, right } = generateOffsetBoundaries(
        subsampled,
        offsetDistance
      );

      return {
        left: pointsToPath(left),
        right: pointsToPath(right),
      };
    }

    return null;
  }, [computedBoundary, svgPoints, offsetDistance]);

  // Determine stroke dash array based on style
  const strokeDasharray = style === 'dashed' ? '8 4' : undefined;

  if (!boundaryPaths) return null;

  return (
    <g className="track-boundaries" opacity={opacity}>
      {/* Left boundary */}
      <path
        d={boundaryPaths.left}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />

      {/* Right boundary */}
      <path
        d={boundaryPaths.right}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
}

export default TrackBoundaries;
