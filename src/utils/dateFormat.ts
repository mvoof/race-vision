export type DateFormat = 'locale' | 'iso' | 'eu' | 'us';

/**
 * Форматирует дату в соответствии с выбранным форматом
 * @param timestamp Unix timestamp в секундах или миллисекундах
 * @param format Формат даты
 * @param locale Локаль для формата 'locale' (по умолчанию системная)
 */
export function formatDate(
  timestamp: number,
  format: DateFormat = 'locale',
  locale?: string
): string {
  // Если timestamp в секундах (меньше 10^12), конвертируем в миллисекунды
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);

  switch (format) {
    case 'iso':
      // YYYY-MM-DD
      return date.toISOString().split('T')[0];

    case 'eu':
      // DD.MM.YYYY
      return `${padZero(date.getDate())}.${padZero(date.getMonth() + 1)}.${date.getFullYear()}`;

    case 'us':
      // MM/DD/YYYY
      return `${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}/${date.getFullYear()}`;

    case 'locale':
    default:
      // Использует локаль пользователя
      return date.toLocaleDateString(locale);
  }
}

/**
 * Форматирует дату со временем
 */
export function formatDateTime(
  timestamp: number,
  format: DateFormat = 'locale',
  locale?: string
): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  const dateStr = formatDate(timestamp, format, locale);
  const timeStr = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;

  return `${dateStr} ${timeStr}`;
}

/**
 * Возвращает период даты относительно сегодня (для группировки)
 */
export function getDatePeriod(
  timestamp: number,
  t: (key: string) => string
): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  const now = new Date();

  // Сбрасываем время для корректного сравнения дат
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (dateOnly.getTime() === today.getTime()) {
    return t('today');
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return t('yesterday');
  }
  if (dateOnly >= weekAgo) {
    return t('thisWeek');
  }
  if (dateOnly >= monthAgo) {
    return t('thisMonth');
  }
  return t('earlier');
}

/**
 * Возвращает первую букву строки (для группировки по алфавиту)
 */
export function getFirstLetter(str: string): string {
  if (!str) return '#';
  const firstChar = str.trim()[0]?.toUpperCase();
  // Если первый символ не буква, возвращаем #
  if (!/[A-ZА-ЯЁ]/i.test(firstChar)) return '#';
  return firstChar;
}

function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}
