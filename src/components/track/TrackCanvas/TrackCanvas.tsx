import React from 'react';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { TrajectoryPoint } from '../../../types';
import styles from './TrackCanvas.module.scss';

export type ColorMode = 'speed' | 'throttle' | 'brake' | 'solid';

interface TrackCanvasProps {
  trajectory: TrajectoryPoint[];
  colorMode?: ColorMode;
  trackColor?: string;
  backgroundColor?: string;
  trackWidth?: number;
  showStartFinish?: boolean;
  cursorDistance?: number | null;
  onDistanceHover?: (distance: number | null) => void;
  className?: string;
}

// Color interpolation for speed heatmap
function speedToColor(
  speed: number,
  minSpeed: number,
  maxSpeed: number
): string {
  const normalized = (speed - minSpeed) / (maxSpeed - minSpeed);
  // HSL: Red (0) -> Yellow (60) -> Green (120)
  const hue = normalized * 120;
  return `hsl(${hue}, 80%, 50%)`;
}

function throttleBrakeToColor(throttle: number, brake: number): string {
  if (brake > 10) {
    // Red for braking
    return `hsl(0, ${Math.min(brake, 100)}%, 50%)`;
  }
  if (throttle > 10) {
    // Green for throttle
    return `hsl(120, ${Math.min(throttle, 100)}%, 50%)`;
  }
  // Gray for coasting
  return 'hsl(0, 0%, 40%)';
}

// Chaikin curve smoothing algorithm
function smoothTrajectory(
  points: { x: number; y: number }[],
  iterations = 2
): { x: number; y: number }[] {
  if (points.length < 3) return points;

  let result = [...points];

  for (let i = 0; i < iterations; i++) {
    const smoothed: { x: number; y: number }[] = [];

    for (let j = 0; j < result.length - 1; j++) {
      const p0 = result[j];
      const p1 = result[j + 1];

      // Q = 0.75 * P0 + 0.25 * P1
      smoothed.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });

      // R = 0.25 * P0 + 0.75 * P1
      smoothed.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }

    result = smoothed;
  }

  return result;
}

export function TrackCanvas({
  trajectory,
  colorMode = 'speed',
  trackColor = '#4a90d9',
  backgroundColor = '#0f0f23',
  trackWidth = 6,
  showStartFinish = true,
  cursorDistance = null,
  onDistanceHover,
  className,
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 400 });

  // Observe container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const { width, height } = size;

  // Normalize coordinates to fit canvas with padding
  const normalizedData = useMemo(() => {
    if (trajectory.length === 0)
      return {
        points: [],
        minSpeed: 0,
        maxSpeed: 100,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      };

    const xs = trajectory.map((p) => p.x);
    const ys = trajectory.map((p) => p.y);
    const speeds = trajectory.map((p) => p.speed);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const padding = 40;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    const scaleX = availableWidth / rangeX;
    const scaleY = availableHeight / rangeY;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = rangeX * scale;
    const scaledHeight = rangeY * scale;
    const offsetX = padding + (availableWidth - scaledWidth) / 2;
    const offsetY = padding + (availableHeight - scaledHeight) / 2;

    const points = trajectory.map((p) => ({
      x: (p.x - minX) * scale + offsetX,
      y: (p.y - minY) * scale + offsetY,
      speed: p.speed,
      throttle: p.throttle ?? 0,
      brake: p.brake ?? 0,
      distance: p.distance,
    }));

    return { points, minSpeed, maxSpeed, scale, offsetX, offsetY };
  }, [trajectory, width, height]);

  // Find point index by distance
  const findPointByDistance = useCallback(
    (distance: number): number => {
      const { points } = normalizedData;
      for (let i = 0; i < points.length; i++) {
        if (points[i].distance >= distance) {
          return i;
        }
      }
      return points.length - 1;
    },
    [normalizedData]
  );

  // Draw the track
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { points, minSpeed, maxSpeed } = normalizedData;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (points.length < 2) return;

    // Smooth the trajectory
    const smoothedPoints = smoothTrajectory(points);

    // Draw track background (wider dark line)
    ctx.beginPath();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = trackWidth + 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(smoothedPoints[0].x, smoothedPoints[0].y);
    for (let i = 1; i < smoothedPoints.length; i++) {
      ctx.lineTo(smoothedPoints[i].x, smoothedPoints[i].y);
    }
    ctx.stroke();

    // Draw colored track segments
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);

      switch (colorMode) {
        case 'speed':
          ctx.strokeStyle = speedToColor(p0.speed, minSpeed, maxSpeed);
          break;
        case 'throttle':
        case 'brake':
          ctx.strokeStyle = throttleBrakeToColor(p0.throttle, p0.brake);
          break;
        case 'solid':
        default:
          ctx.strokeStyle = trackColor;
      }

      ctx.lineWidth = trackWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Draw start/finish marker
    if (showStartFinish && points.length > 0) {
      const start = points[0];
      ctx.beginPath();
      ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw cursor position
    if (cursorDistance !== null) {
      const idx = findPointByDistance(cursorDistance);
      const point = points[idx];
      if (point) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9800';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [
    normalizedData,
    width,
    height,
    colorMode,
    trackColor,
    backgroundColor,
    trackWidth,
    showStartFinish,
    cursorDistance,
    findPointByDistance,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse move for distance hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onDistanceHover) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const { points } = normalizedData;
      if (points.length === 0) {
        onDistanceHover(null);
        return;
      }

      // Find closest point
      let closestIdx = 0;
      let closestDist = Infinity;

      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - x;
        const dy = points[i].y - y;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      // Only report if close enough (within 20px)
      if (Math.sqrt(closestDist) < 20) {
        onDistanceHover(points[closestIdx].distance);
      } else {
        onDistanceHover(null);
      }
    },
    [normalizedData, onDistanceHover]
  );

  const handleMouseLeave = useCallback(() => {
    if (onDistanceHover) {
      onDistanceHover(null);
    }
  }, [onDistanceHover]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className ?? ''}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

export default TrackCanvas;
