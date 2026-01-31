import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  Session,
  Lap,
  LapTelemetry,
  TrajectoryPoint,
  TelemetryFileInfo,
  TrackBoundaryEnvelope,
  Corner,
} from '../../types';

/**
 * Открыть диалог выбора файла телеметрии
 */
export async function openFileDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'Telemetry Files',
        extensions: ['duckdb', 'db'],
      },
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  });

  if (selected === null || Array.isArray(selected)) {
    return null;
  }

  return selected;
}

/**
 * Открыть файл телеметрии
 */
export async function openTelemetryFile(path: string): Promise<Session> {
  return invoke<Session>('open_telemetry_file', { path });
}

/**
 * Получить информацию о текущей сессии
 */
export async function getSessionInfo(): Promise<Session> {
  return invoke<Session>('get_session_info');
}

/**
 * Получить список кругов
 */
export async function getLaps(): Promise<Lap[]> {
  return invoke<Lap[]>('get_laps');
}

/**
 * Получить телеметрию для круга
 */
export async function getLapTelemetry(
  lapNumber: number
): Promise<LapTelemetry> {
  return invoke<LapTelemetry>('get_lap_telemetry', { lapNumber });
}

/**
 * Получить траекторию для отрисовки
 */
export async function getTrajectory(
  lapNumber: number
): Promise<TrajectoryPoint[]> {
  return invoke<TrajectoryPoint[]>('get_trajectory', { lapNumber });
}

/**
 * Комбинированная функция: открыть диалог и загрузить файл
 */
export async function openAndLoadTelemetryFile(): Promise<{
  session: Session;
  laps: Lap[];
} | null> {
  const path = await openFileDialog();
  if (!path) return null;

  const session = await openTelemetryFile(path);
  const laps = await getLaps();

  return { session, laps };
}

/**
 * Открыть диалог выбора папки
 */
export async function openFolderDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });

  if (selected === null || Array.isArray(selected)) {
    return null;
  }

  return selected;
}

/**
 * Сканировать папку с телеметрией
 */
export async function scanTelemetryFolder(
  folderPath: string
): Promise<TelemetryFileInfo[]> {
  return invoke<TelemetryFileInfo[]>('scan_telemetry_folder', { folderPath });
}

/**
 * Загрузить файл телеметрии по пути (без диалога)
 */
export async function loadTelemetryFile(path: string): Promise<{
  session: Session;
  laps: Lap[];
}> {
  const session = await openTelemetryFile(path);
  const laps = await getLaps();
  return { session, laps };
}

/**
 * Анализировать все телеметрии для трека и построить envelope границ
 */
export async function analyzeTrackBoundaries(
  folderPath: string,
  trackName: string
): Promise<TrackBoundaryEnvelope> {
  return invoke<TrackBoundaryEnvelope>('analyze_track_boundaries', {
    folderPath,
    trackName,
  });
}

/**
 * Detect corners using Rust backend
 */
export async function analyzeCorners(
  trajectory: TrajectoryPoint[]
): Promise<Corner[]> {
  return invoke<Corner[]>('analyze_corners', { trajectory });
}
