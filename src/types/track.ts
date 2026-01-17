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
