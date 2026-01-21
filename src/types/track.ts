/**
 * Границы координат трека
 */
export interface TrackBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Точка на треке
 */
export interface TrackPoint {
  x: number;
  y: number;
  distance: number; // distance from start line
}

/**
 * Граница сектора
 */
export interface SectorBoundary {
  sectorNumber: 1 | 2 | 3;
  startDistance: number;
  endDistance: number;
  position: TrackPoint;
}

/**
 * Данные трека для отрисовки
 */
export interface TrackData {
  id: string;
  name: string;
  layout: string;
  length: number; // meters

  // Геометрия (из первого круга или референсного)
  centerLine: TrackPoint[];
  bounds: TrackBounds;

  // Секторы
  sectors: SectorBoundary[];

  // Опционально: точки интереса
  startFinishLine?: TrackPoint;
  pitEntry?: TrackPoint;
  pitExit?: TrackPoint;
}

/**
 * Геометрия для Canvas рендеринга
 */
export interface TrackGeometry {
  // Нормализованные точки (0-1 диапазон)
  normalizedPoints: { x: number; y: number }[];

  // Параметры трансформации для Canvas
  scale: number;
  offsetX: number;
  offsetY: number;

  // Исходные bounds
  bounds: TrackBounds;
}

/**
 * Опции отрисовки трека
 */
export interface TrackRenderOptions {
  showSpeedHeatmap: boolean;
  showBrakingZones: boolean;
  showThrottleZones: boolean;
  showSectors: boolean;
  showCornerNumbers: boolean;
  trajectoryWidth: number;
  backgroundColor: string;
  trackOutlineColor: string;
  trackOutlineWidth: number;
}

// ============================================
// GeoJSON Types for Track Boundaries
// ============================================

/**
 * GeoJSON geometry type for LineString
 */
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [longitude, latitude][]
}

/**
 * GeoJSON feature
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: GeoJSONLineString;
}

/**
 * GeoJSON feature collection
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Geographic bounds (WGS84)
 */
export interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/**
 * Track boundary data from GeoJSON
 */
export interface TrackBoundary {
  name: string;
  geojsonFile: string;
  coordinates: [number, number][]; // [longitude, latitude][]
  bounds: GeoBounds;
}

/**
 * Complete track boundary data with all loaded boundaries
 */
export interface TrackBoundaryData {
  trackName: string;
  boundaries: TrackBoundary[];
  combinedBounds: GeoBounds;
}

/**
 * Coordinate transformation functions
 */
export interface CoordinateTransform {
  geoToSvg: (lon: number, lat: number) => { x: number; y: number };
  svgToGeo: (x: number, y: number) => { lon: number; lat: number };
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * SVG viewport configuration
 */
export interface SVGViewport {
  width: number;
  height: number;
  padding: number;
  viewBox: string;
}

// ============================================
// Computed Boundary Types (Frenet-based)
// ============================================

/**
 * Point in 2D space
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Frenet coordinate point
 * s = distance along track, d = lateral deviation
 */
export interface FrenetPoint {
  s: number;
  d: number;
}

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
 * Reference line point with heading
 */
export interface ReferenceLinePoint extends Point2D {
  s: number;
  heading: number;
}

/**
 * Reference line for Frenet transformations
 */
export interface ReferenceLine {
  points: ReferenceLinePoint[];
  totalLength: number;
}

/**
 * Computed track boundary from telemetry data
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
 * Boundary generation mode
 */
export type BoundaryMode = 'auto' | 'manual' | 'geojson';

/**
 * Boundary display settings
 */
export interface BoundarySettings {
  mode: BoundaryMode;
  showBoundaries: boolean;
  mergeWithManual: boolean;
  fallbackWidth: number; // meters
  segmentSize: number; // meters
  boundaryOpacity: number;
  boundaryColor: string;
  boundaryStyle: 'solid' | 'dashed';
}

/**
 * Default boundary settings
 */
export const DEFAULT_BOUNDARY_SETTINGS: BoundarySettings = {
  mode: 'auto',
  showBoundaries: true,
  mergeWithManual: false,
  fallbackWidth: 6,
  segmentSize: 5,
  boundaryOpacity: 0.7,
  boundaryColor: '#666666',
  boundaryStyle: 'dashed',
};
