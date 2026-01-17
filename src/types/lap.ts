/**
 * Информация о круге
 */
export interface Lap {
  id: string;
  sessionId: string;
  lapNumber: number;

  // Время круга
  lapTime: number | null; // seconds, null если не завершён
  sector1Time: number | null;
  sector2Time: number | null;
  sector3Time: number | null;

  // Timestamps
  startTimestamp: number; // seconds from session start
  endTimestamp: number | null;

  // Статус
  isValid: boolean;
  isComplete: boolean;
  isInLap: boolean; // выезд из боксов
  isOutLap: boolean; // заезд в боксы

  // Флаги лучших результатов
  isPersonalBest: boolean;
  isSessionBest: boolean;
  isSector1Best: boolean;
  isSector2Best: boolean;
  isSector3Best: boolean;

  // Delta к лучшему
  deltaToSessionBest: number | null;

  // Дополнительная статистика
  maxSpeed: number | null; // km/h
  averageSpeed: number | null; // km/h
  fuelUsed: number | null; // liters
  fuelAtStart: number | null; // liters
  fuelAtEnd: number | null; // liters
}

/**
 * Информация о секторе
 */
export interface SectorInfo {
  sectorNumber: 1 | 2 | 3;
  time: number; // seconds
  deltaToSessionBest: number;
  isPersonalBest: boolean;
  isSessionBest: boolean;
}

/**
 * Теоретически лучший круг (сумма лучших секторов)
 */
export interface TheoreticalBestLap {
  totalTime: number; // seconds
  sectors: {
    sectorNumber: 1 | 2 | 3;
    time: number;
    fromLapNumber: number;
  }[];
  deltaToActualBest: number; // разница с реальным лучшим кругом
}

/**
 * Краткая информация о круге для списка
 */
export interface LapSummary {
  lapNumber: number;
  lapTime: number | null;
  sector1Time: number | null;
  sector2Time: number | null;
  sector3Time: number | null;
  isValid: boolean;
  isPersonalBest: boolean;
  deltaToSessionBest: number | null;
}
