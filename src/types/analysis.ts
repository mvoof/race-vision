/**
 * Точка delta между двумя кругами
 */
export interface DeltaPoint {
  distance: number; // lap distance (m)
  delta: number; // seconds (positive = comparison faster)
  speed1: number; // reference lap speed
  speed2: number; // comparison lap speed
}

/**
 * Delta между двумя кругами
 */
export interface LapDelta {
  referenceLapNumber: number;
  comparisonLapNumber: number;

  // Delta по дистанции
  deltaByDistance: DeltaPoint[];

  // Итоговая разница
  totalDelta: number; // seconds

  // Экстремумы
  maxGain: number; // max time gained (positive)
  maxLoss: number; // max time lost (negative)
  maxGainDistance: number; // distance where max gain occurred
  maxLossDistance: number; // distance where max loss occurred

  // По секторам
  sector1Delta: number;
  sector2Delta: number;
  sector3Delta: number;
}

/**
 * Данные для G-G диаграммы (friction circle)
 */
export interface GGDiagramData {
  lapNumber: number;
  points: { gX: number; gY: number }[]; // lateral, longitudinal

  // Границы
  maxLateralG: number;
  maxLongitudinalGAccel: number;
  maxLongitudinalGBrake: number;

  // Расчётный радиус friction circle
  frictionCircleRadius: number;
}

/**
 * Сегмент потери времени
 */
export interface TimeLossSegment {
  startDistance: number;
  endDistance: number;
  timeLoss: number; // seconds (positive = loss)
  category: TimeLossCategory;
  description?: string;
}

export type TimeLossCategory =
  | 'braking_early'
  | 'braking_late'
  | 'slow_corner_entry'
  | 'slow_corner_exit'
  | 'slow_acceleration'
  | 'slow_straight'
  | 'track_limits'
  | 'other';

/**
 * Анализ потери времени
 */
export interface TimeLossAnalysis {
  referenceLapNumber: number;
  comparisonLapNumber: number;
  segments: TimeLossSegment[];
  totalTimeLoss: number;
  topLossSegments: TimeLossSegment[]; // top 5 by time loss
}

/**
 * Анализ консистентности
 */
export interface ConsistencyData {
  lapNumbers: number[];
  lapTimes: number[];

  // Статистика
  mean: number;
  median: number;
  standardDeviation: number;
  consistency: number; // 0-100% (based on std dev)

  // Выбросы
  outlierLaps: number[];

  // По секторам
  sectorConsistency: {
    sector: 1 | 2 | 3;
    mean: number;
    stdDev: number;
    consistency: number;
  }[];
}

/**
 * Анализ стинта
 */
export interface StintAnalysis {
  startLap: number;
  endLap: number;
  lapsCount: number;

  // Деградация шин
  tireWearStart: [number, number, number, number]; // %
  tireWearEnd: [number, number, number, number];
  tireWearPerLap: number; // average % per lap

  // Топливо
  fuelAtStart: number; // liters
  fuelAtEnd: number;
  fuelPerLap: number; // average liters per lap
  estimatedLapsRemaining: number;

  // Время кругов
  lapTimes: number[];
  lapTimeDegradation: number; // seconds per lap slowdown

  // Температуры (средние)
  avgTireTemp: [number, number, number, number];
  avgBrakeTemp: [number, number, number, number];
}

/**
 * Сравнение сетапов
 */
export interface SetupComparison {
  session1Id: string;
  session2Id: string;

  // Разница во времени
  bestLapDelta: number;
  averageLapDelta: number;

  // Разница в характеристиках
  maxSpeedDelta: number;
  cornerSpeedDelta: number; // average through corners

  // Секторальная разница
  sectorDeltas: [number, number, number];
}
