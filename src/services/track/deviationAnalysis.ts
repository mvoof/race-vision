import type {
  TrackBoundaryEnvelope,
  TrackBoundaryPoint,
  TrajectoryPoint,
  TrackDeviationAnalysis,
  BoundaryViolation,
} from '../../types';

/**
 * Найти ближайшую точку envelope по дистанции
 */
function findNearestEnvelopePoint(
  distance: number,
  envelope: TrackBoundaryEnvelope
): TrackBoundaryPoint | null {
  if (envelope.points.length === 0) return null;

  let closestPoint = envelope.points[0];
  let minDiff = Math.abs(closestPoint.distance - distance);

  for (const point of envelope.points) {
    const diff = Math.abs(point.distance - distance);
    if (diff < minDiff) {
      minDiff = diff;
      closestPoint = point;
    }
  }

  return closestPoint;
}

/**
 * Вычислить расстояние между двумя точками
 */
function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Анализировать отклонение траектории от оптимальной линии
 */
export function analyzeTrajectoryDeviation(
  trajectory: TrajectoryPoint[],
  envelope: TrackBoundaryEnvelope
): TrackDeviationAnalysis[] {
  const results: TrackDeviationAnalysis[] = [];

  for (const point of trajectory) {
    const envelopePoint = findNearestEnvelopePoint(point.distance, envelope);
    if (!envelopePoint) continue;

    // Вычисляем отклонение от центральной линии
    const deviation = distance2D(
      point.x,
      point.y,
      envelopePoint.centerX,
      envelopePoint.centerY
    );

    // Вычисляем ширину трека в этой точке
    const trackWidth = distance2D(
      envelopePoint.minX,
      envelopePoint.minY,
      envelopePoint.maxX,
      envelopePoint.maxY
    );

    // Процент отклонения (0 = центр, 100 = на границе)
    const deviationPercent =
      trackWidth > 0 ? (deviation / (trackWidth / 2)) * 100 : 0;

    // Определяем категорию
    let category: 'safe' | 'warning' | 'danger';
    if (deviationPercent < 60) {
      category = 'safe';
    } else if (deviationPercent < 85) {
      category = 'warning';
    } else {
      category = 'danger';
    }

    results.push({
      distance: point.distance,
      actualX: point.x,
      actualY: point.y,
      optimalX: envelopePoint.centerX,
      optimalY: envelopePoint.centerY,
      deviation,
      deviationPercent,
      category,
    });
  }

  return results;
}

/**
 * Определить точки касания границ трека
 */
export function detectBoundaryViolations(
  trajectory: TrajectoryPoint[],
  envelope: TrackBoundaryEnvelope,
  threshold: number = 0.5 // метры за границей
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const point of trajectory) {
    const envelopePoint = findNearestEnvelopePoint(point.distance, envelope);
    if (!envelopePoint) continue;

    // Проверяем расстояние до внутренней границы
    const distToInner = distance2D(
      point.x,
      point.y,
      envelopePoint.minX,
      envelopePoint.minY
    );

    // Проверяем расстояние до внешней границы
    const distToOuter = distance2D(
      point.x,
      point.y,
      envelopePoint.maxX,
      envelopePoint.maxY
    );

    // Расстояние от центра до границ
    const distCenterToInner = distance2D(
      envelopePoint.centerX,
      envelopePoint.centerY,
      envelopePoint.minX,
      envelopePoint.minY
    );

    const distCenterToOuter = distance2D(
      envelopePoint.centerX,
      envelopePoint.centerY,
      envelopePoint.maxX,
      envelopePoint.maxY
    );

    // Определяем, вышли ли за границу
    if (distToInner < threshold) {
      violations.push({
        distance: point.distance,
        x: point.x,
        y: point.y,
        side: 'inner',
        overrun: threshold - distToInner,
      });
    }

    if (distToOuter < threshold) {
      violations.push({
        distance: point.distance,
        x: point.x,
        y: point.y,
        side: 'outer',
        overrun: threshold - distToOuter,
      });
    }

    // Альтернативный метод: проверяем, находимся ли мы дальше от центра чем граница
    const distToCenter = distance2D(
      point.x,
      point.y,
      envelopePoint.centerX,
      envelopePoint.centerY
    );

    if (distToCenter > distCenterToInner + threshold) {
      const overrun = distToCenter - distCenterToInner;
      if (
        !violations.some(
          (v) => v.distance === point.distance && v.side === 'inner'
        )
      ) {
        violations.push({
          distance: point.distance,
          x: point.x,
          y: point.y,
          side: 'inner',
          overrun,
        });
      }
    }

    if (distToCenter > distCenterToOuter + threshold) {
      const overrun = distToCenter - distCenterToOuter;
      if (
        !violations.some(
          (v) => v.distance === point.distance && v.side === 'outer'
        )
      ) {
        violations.push({
          distance: point.distance,
          x: point.x,
          y: point.y,
          side: 'outer',
          overrun,
        });
      }
    }
  }

  return violations;
}

/**
 * Получить цвет для визуализации отклонения
 */
export function getDeviationColor(
  category: 'safe' | 'warning' | 'danger'
): string {
  switch (category) {
    case 'safe':
      return '#00ff00'; // зеленый
    case 'warning':
      return '#ffff00'; // желтый
    case 'danger':
      return '#ff0000'; // красный
  }
}
