/**
 * Данные для 4 колёс [FL, FR, RL, RR]
 */
export type WheelData = [number, number, number, number];

/**
 * Единичный sample телеметрии (нормализованный)
 * Все данные интерполированы к единому timestamp
 */
export interface TelemetrySample {
  // Время и позиция
  timestamp: number; // seconds from lap start
  lapDistance: number; // meters from lap start
  totalDistance: number; // meters from session start

  // Позиция в пространстве (для отрисовки трека)
  posX: number; // GPS Latitude (relative coords)
  posY: number; // GPS Longitude (relative coords)

  // Скорость
  speed: number; // km/h (Ground Speed)
  wheelSpeed: WheelData; // m/s

  // Inputs водителя
  throttle: number; // 0-100 %
  brake: number; // 0-100 %
  clutch: number; // 0-100 %
  steering: number; // degrees or normalized

  // Двигатель
  rpm: number;
  gear: number; // -1 = reverse, 0 = neutral, 1-8 = gears

  // G-силы
  gForceX: number; // lateral (G)
  gForceY: number; // longitudinal (G)
  gForceZ: number; // vertical (G)

  // Шины - температуры (°C)
  tireTempLeft: WheelData;
  tireTempCenter: WheelData;
  tireTempRight: WheelData;

  // Шины - другие параметры
  tirePressure: WheelData; // kPa
  tireWear: WheelData; // % remaining

  // Тормоза
  brakeTemp: WheelData; // °C

  // Топливо
  fuelLevel: number; // liters

  // Подвеска
  suspensionPos: WheelData; // m
  rideHeightFront: number; // m
  rideHeightRear: number; // m
}

/**
 * Облегчённые данные для отрисовки траектории
 */
export interface TrajectoryPoint {
  x: number; // normalized or GPS latitude
  y: number; // normalized or GPS longitude
  distance: number; // lap distance (m)
  speed: number; // km/h
  throttle?: number; // optional for coloring
  brake?: number; // optional for coloring
}

/**
 * Данные телеметрии для одного круга
 */
export interface LapTelemetry {
  lapNumber: number;
  samples: TelemetrySample[];
  sampleRate: number; // effective Hz after normalization
  duration: number; // seconds
  distance: number; // meters
}

/**
 * Минимальные данные для графиков (один канал)
 */
export interface ChannelData {
  timestamps: number[]; // or distances
  values: number[];
}

/**
 * Данные для графика с несколькими каналами
 */
export interface ChartData {
  xAxis: 'time' | 'distance';
  xValues: number[];
  channels: {
    name: string;
    values: number[];
    unit: string;
    color?: string;
  }[];
}
