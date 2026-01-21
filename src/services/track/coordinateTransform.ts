import type {
  GeoBounds,
  CoordinateTransform,
  TrajectoryPoint,
} from '../../types';

/**
 * Calculate geographic bounds from coordinates
 */
export function calculateGeoBounds(coordinates: [number, number][]): GeoBounds {
  if (coordinates.length === 0) {
    return { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 };
  }

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coordinates) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Calculate bounds from trajectory points
 * Note: In LMU telemetry, posX = latitude, posY = longitude
 */
export function calculateBoundsFromTrajectory(
  trajectory: TrajectoryPoint[]
): GeoBounds {
  if (trajectory.length === 0) {
    return { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 };
  }

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const point of trajectory) {
    // posX is latitude, posY is longitude in LMU telemetry
    const lat = point.x;
    const lon = point.y;

    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Merge two geographic bounds
 */
export function mergeGeoBounds(a: GeoBounds, b: GeoBounds): GeoBounds {
  return {
    minLon: Math.min(a.minLon, b.minLon),
    maxLon: Math.max(a.maxLon, b.maxLon),
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
  };
}

/**
 * Create coordinate transform for converting geo coordinates to SVG coordinates
 *
 * The transform accounts for:
 * 1. Latitude correction (cos(avgLat)) for mercator-like projection
 * 2. Y-axis inversion (SVG Y goes down, latitude goes up)
 * 3. Scaling to fit viewport with padding
 * 4. Centering in viewport
 */
export function createCoordinateTransform(
  bounds: GeoBounds,
  svgWidth: number,
  svgHeight: number,
  padding: number = 40
): CoordinateTransform {
  const { minLon, maxLon, minLat, maxLat } = bounds;

  // Calculate average latitude for mercator correction
  const avgLat = (minLat + maxLat) / 2;
  const latCorrection = Math.cos((avgLat * Math.PI) / 180);

  // Calculate ranges with latitude correction for X (longitude)
  const lonRange = (maxLon - minLon) * latCorrection;
  const latRange = maxLat - minLat;

  // Handle edge cases
  const effectiveLonRange = lonRange || 0.0001;
  const effectiveLatRange = latRange || 0.0001;

  // Available space
  const availableWidth = svgWidth - padding * 2;
  const availableHeight = svgHeight - padding * 2;

  // Calculate scale to fit both dimensions
  const scaleX = availableWidth / effectiveLonRange;
  const scaleY = availableHeight / effectiveLatRange;
  const scale = Math.min(scaleX, scaleY);

  // Calculate scaled dimensions
  const scaledWidth = effectiveLonRange * scale;
  const scaledHeight = effectiveLatRange * scale;

  // Calculate offsets to center
  const offsetX = padding + (availableWidth - scaledWidth) / 2;
  const offsetY = padding + (availableHeight - scaledHeight) / 2;

  return {
    geoToSvg: (lon: number, lat: number) => {
      // Apply latitude correction to longitude
      const x = (lon - minLon) * latCorrection * scale + offsetX;
      // Invert Y axis (SVG Y goes down, latitude goes up)
      const y = svgHeight - offsetY - (lat - minLat) * scale;
      return { x, y };
    },
    svgToGeo: (x: number, y: number) => {
      const lon = (x - offsetX) / (latCorrection * scale) + minLon;
      const lat = (svgHeight - offsetY - y) / scale + minLat;
      return { lon, lat };
    },
    scale,
    offsetX,
    offsetY,
  };
}

/**
 * Transform trajectory points to SVG coordinates
 * In LMU telemetry: posX = latitude, posY = longitude
 */
export function transformTrajectoryToSvg(
  trajectory: TrajectoryPoint[],
  transform: CoordinateTransform
): {
  x: number;
  y: number;
  speed: number;
  distance: number;
  throttle?: number;
  brake?: number;
}[] {
  return trajectory.map((point) => {
    // LMU telemetry: x is latitude, y is longitude
    const { x, y } = transform.geoToSvg(point.y, point.x);
    return {
      x,
      y,
      speed: point.speed,
      distance: point.distance,
      throttle: point.throttle,
      brake: point.brake,
    };
  });
}

/**
 * Transform GeoJSON coordinates to SVG path
 */
export function transformGeoJSONToSvgPath(
  coordinates: [number, number][],
  transform: CoordinateTransform
): string {
  if (coordinates.length === 0) return '';

  const points = coordinates.map(([lon, lat]) => transform.geoToSvg(lon, lat));

  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}
