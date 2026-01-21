import { useMemo } from 'react';

export type ColorMode = 'speed' | 'throttle' | 'brake' | 'solid';

interface TransformedPoint {
  x: number;
  y: number;
  speed: number;
  distance: number;
  throttle?: number;
  brake?: number;
}

interface RacingLineProps {
  points: TransformedPoint[];
  colorMode?: ColorMode;
  trackColor?: string;
  trackWidth?: number;
  minSpeed?: number;
  maxSpeed?: number;
}

/**
 * Speed to HSL color (red = slow, green = fast)
 */
function speedToColor(
  speed: number,
  minSpeed: number,
  maxSpeed: number
): string {
  const range = maxSpeed - minSpeed || 1;
  const normalized = Math.max(0, Math.min(1, (speed - minSpeed) / range));
  // HSL: Red (0) -> Yellow (60) -> Green (120)
  const hue = normalized * 120;
  return `hsl(${hue}, 80%, 50%)`;
}

/**
 * Throttle/brake to color
 */
function throttleBrakeToColor(throttle: number, brake: number): string {
  if (brake > 10) {
    return `hsl(0, ${Math.min(brake, 100)}%, 50%)`;
  }
  if (throttle > 10) {
    return `hsl(120, ${Math.min(throttle, 100)}%, 50%)`;
  }
  return 'hsl(0, 0%, 40%)';
}

/**
 * Create SVG path segments with individual colors
 */
function createColoredSegments(
  points: TransformedPoint[],
  colorMode: ColorMode,
  trackColor: string,
  minSpeed: number,
  maxSpeed: number
): { path: string; color: string }[] {
  if (points.length < 2) return [];

  const segments: { path: string; color: string }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    const path = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;

    let color: string;
    switch (colorMode) {
      case 'speed':
        color = speedToColor(p0.speed, minSpeed, maxSpeed);
        break;
      case 'throttle':
      case 'brake':
        color = throttleBrakeToColor(p0.throttle ?? 0, p0.brake ?? 0);
        break;
      case 'solid':
      default:
        color = trackColor;
    }

    segments.push({ path, color });
  }

  return segments;
}

/**
 * Create solid SVG path from points
 */
function createSolidPath(points: TransformedPoint[]): string {
  if (points.length === 0) return '';

  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

export function RacingLine({
  points,
  colorMode = 'speed',
  trackColor = '#4a90d9',
  trackWidth = 4,
  minSpeed,
  maxSpeed,
}: RacingLineProps) {
  // Calculate min/max speed if not provided
  const { computedMinSpeed, computedMaxSpeed } = useMemo(() => {
    if (minSpeed !== undefined && maxSpeed !== undefined) {
      return { computedMinSpeed: minSpeed, computedMaxSpeed: maxSpeed };
    }
    const speeds = points.map((p) => p.speed);
    return {
      computedMinSpeed: minSpeed ?? Math.min(...speeds),
      computedMaxSpeed: maxSpeed ?? Math.max(...speeds),
    };
  }, [points, minSpeed, maxSpeed]);

  // Create path for track background
  const backgroundPath = useMemo(() => createSolidPath(points), [points]);

  // Create colored segments
  const segments = useMemo(
    () =>
      colorMode === 'solid'
        ? []
        : createColoredSegments(
            points,
            colorMode,
            trackColor,
            computedMinSpeed,
            computedMaxSpeed
          ),
    [points, colorMode, trackColor, computedMinSpeed, computedMaxSpeed]
  );

  if (points.length < 2) return null;

  return (
    <g className="racing-line">
      {/* Track background (wider dark line) */}
      <path
        d={backgroundPath}
        fill="none"
        stroke="#1a1a2e"
        strokeWidth={trackWidth + 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Colored segments or solid path */}
      {colorMode === 'solid' ? (
        <path
          d={backgroundPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={trackWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        segments.map((segment, i) => (
          <path
            key={i}
            d={segment.path}
            fill="none"
            stroke={segment.color}
            strokeWidth={trackWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </g>
  );
}

export default RacingLine;
