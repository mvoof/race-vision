/**
 * Информация о файле телеметрии для отображения в списке
 */
export interface TelemetryFileInfo {
  /** Полный путь к файлу */
  path: string;
  /** Имя файла */
  fileName: string;
  /** Название трека (из metadata) */
  trackName: string | null;
  /** Название машины (из metadata) */
  carName: string | null;
  /** Тип сессии (из metadata) */
  sessionType: string | null;
  /** Имя драйвера (из metadata) */
  driverName: string | null;
  /** Время записи (из metadata) */
  recordingTime: string | null;
  /** Размер файла в байтах */
  fileSize: number;
  /** Время модификации файла (Unix timestamp) */
  modifiedTime: number;
}
