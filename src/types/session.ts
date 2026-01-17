/**
 * Источник телеметрии (игра)
 */
export type TelemetrySource = 'lmu' | 'acc' | 'iracing' | 'rf2' | 'unknown';

/**
 * Тип сессии
 */
export type SessionType = 'practice' | 'qualifying' | 'race' | 'hotlap' | 'unknown';

/**
 * Погодные условия
 */
export interface WeatherCondition {
  description: string; // "Clear", "Cloudy & Light Rain", etc.
  trackTemp?: number; // °C
  ambientTemp?: number; // °C
  windSpeed?: number; // m/s
  windHeading?: number; // deg
}

/**
 * Информация о сессии
 */
export interface Session {
  id: string;
  source: TelemetrySource;

  // Файл
  filePath: string;
  fileName: string;

  // Метаданные
  driverName: string;
  recordingTime: string; // ISO timestamp
  sessionTime: string; // HH:MM:SS

  // Трек и машина
  trackName: string;
  trackLayout: string;
  carName: string;
  carClass: string;

  // Тип и условия
  sessionType: SessionType;
  weather: WeatherCondition;

  // Статистика (заполняется после загрузки кругов)
  totalLaps: number;
  bestLapTime: number | null; // seconds
  totalDuration: number; // seconds
}

/**
 * Информация о канале телеметрии
 */
export interface TelemetryChannel {
  name: string;
  frequency: number; // Hz
  unit: string;
}

/**
 * Сырые метаданные из DuckDB
 */
export interface RawMetadata {
  version: string;
  driverName: string;
  steamId: string;
  recordingTime: string;
  sessionTime: string;
  sessionType: string;
  trackName: string;
  trackLayout: string;
  weatherConditions: string;
  carName: string;
  carClass: string;
  carSetup?: string; // JSON string
}
