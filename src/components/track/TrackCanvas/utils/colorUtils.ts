export type ColorMode = 'speed' | 'throttle' | 'brake' | 'solid';

interface ColorablePoint {
  speed: number;
  throttle?: number;
  brake?: number;
}

/**
 * Speed to HSL color string (red = slow, green = fast)
 */
export function speedToColor(
  speed: number,
  minSpeed: number,
  maxSpeed: number
): string {
  const range = maxSpeed - minSpeed || 1;
  const normalized = Math.max(0, Math.min(1, (speed - minSpeed) / range));
  const hue = normalized * 120;
  return `hsl(${hue}, 80%, 50%)`;
}

/**
 * Throttle/brake to color
 */
export function throttleBrakeToColor(throttle: number, brake: number): string {
  if (brake > 10) {
    return `hsl(0, ${Math.min(brake, 100)}%, 50%)`;
  }
  if (throttle > 10) {
    return `hsl(120, ${Math.min(throttle, 100)}%, 50%)`;
  }
  return 'hsl(0, 0%, 40%)';
}

/**
 * Pre-compute all segment colors in one pass.
 * Returns an array of CSS color strings (length = points.length - 1).
 */
export function precomputeColorArray(
  points: ColorablePoint[],
  colorMode: ColorMode,
  trackColor: string = '#4a90d9'
): string[] {
  if (points.length < 2) return [];

  if (colorMode === 'solid') {
    // Single color for all segments — still return array for uniform API
    const arr = new Array<string>(points.length - 1);
    arr.fill(trackColor);
    return arr;
  }

  // Compute min/max speed once
  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  for (const p of points) {
    if (p.speed < minSpeed) minSpeed = p.speed;
    if (p.speed > maxSpeed) maxSpeed = p.speed;
  }

  const colors: string[] = new Array(points.length - 1);

  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    switch (colorMode) {
      case 'speed':
        colors[i] = speedToColor(p.speed, minSpeed, maxSpeed);
        break;
      case 'throttle':
      case 'brake':
        colors[i] = throttleBrakeToColor(p.throttle ?? 0, p.brake ?? 0);
        break;
    }
  }

  return colors;
}
