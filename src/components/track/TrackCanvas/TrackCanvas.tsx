import { useRef, useEffect, useCallback, useMemo, useState, type RefObject } from 'react';
import { Crosshair } from 'lucide-react';
import type {
  TrajectoryPoint,
  CoordinateTransform,
  GeoBounds,
  ComputedTrackBoundary,
  TrackBoundaryEnvelope,
  Corner,
  Point2D,
} from '../../../types';
import {
  createCoordinateTransform,
  transformTrajectoryToSvg,
  calculateBoundsFromTrajectory,
  detectCorners,
} from '../../../services/track';
import { precomputeColorArray, type ColorMode } from './utils/colorUtils';
import { buildSpatialGrid, findNearestPoint } from './utils/spatialIndex';
import { screenToWorld } from './utils/canvasTransform';
import type { Camera } from './utils/canvasTransform';
import { useCanvasRenderer } from './useCanvasRenderer';
import styles from './TrackCanvas.module.scss';

export type { ColorMode };

interface TrackCanvasProps {
  trajectory: TrajectoryPoint[];
  computedBoundary?: ComputedTrackBoundary | null;
  envelope?: TrackBoundaryEnvelope | null;
  colorMode?: ColorMode;
  trackColor?: string;
  trackWidth?: number;
  showStartFinish?: boolean;
  showBoundaries?: boolean;
  showEnvelope?: boolean;
  showCorners?: boolean;
  boundaryStyle?: 'solid' | 'dashed';
  boundaryColor?: string;
  boundaryOpacity?: number;
  cursorDistance?: number | null;
  /** High-frequency cursor distance ref — updated at 60fps during playback.
   *  The cursor rAF loop reads from this ref to bypass React's render cycle. */
  cursorDistanceRef?: RefObject<number | null>;
  currentLapTime?: number | null;
  currentLapNumber?: number | null;
  deltaTime?: number | null;
  onDistanceHover?: (distance: number | null) => void;
  className?: string;
  viewBox?: { x: number; y: number; width: number; height: number } | null;
  onViewBoxChange?: (viewBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

const PADDING = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_FACTOR = 0.1;

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

function formatDelta(seconds: number): string {
  const sign = seconds > 0 ? '+' : '';
  return `${sign}${seconds.toFixed(3)}`;
}

/**
 * Generate offset boundaries from SVG points (fallback when no envelope/computed boundary)
 */
function generateOffsetBoundaries(
  points: Point2D[],
  offset: number
): { left: Point2D[]; right: Point2D[] } {
  if (points.length < 2) return { left: [], right: [] };

  const left: Point2D[] = [];
  const right: Point2D[] = [];

  // Subsample for smoother boundaries
  const subsampled: Point2D[] = [];
  for (let i = 0; i < points.length; i += 3) {
    subsampled.push(points[i]);
  }
  if (subsampled[subsampled.length - 1] !== points[points.length - 1]) {
    subsampled.push(points[points.length - 1]);
  }

  for (let i = 0; i < subsampled.length; i++) {
    let dx: number, dy: number;

    if (i === 0) {
      dx = subsampled[1].x - subsampled[0].x;
      dy = subsampled[1].y - subsampled[0].y;
    } else if (i === subsampled.length - 1) {
      dx = subsampled[i].x - subsampled[i - 1].x;
      dy = subsampled[i].y - subsampled[i - 1].y;
    } else {
      dx = (subsampled[i + 1].x - subsampled[i - 1].x) / 2;
      dy = (subsampled[i + 1].y - subsampled[i - 1].y) / 2;
    }

    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) continue;

    const perpX = -dy / length;
    const perpY = dx / length;

    left.push({
      x: subsampled[i].x + perpX * offset,
      y: subsampled[i].y + perpY * offset,
    });
    right.push({
      x: subsampled[i].x - perpX * offset,
      y: subsampled[i].y - perpY * offset,
    });
  }

  return { left, right };
}

export function TrackCanvas({
  trajectory,
  computedBoundary,
  envelope,
  colorMode = 'speed',
  trackColor = '#4a90d9',
  trackWidth = 3,
  showStartFinish = true,
  showBoundaries = true,
  showEnvelope = true,
  showCorners = true,
  boundaryStyle = 'solid',
  boundaryColor = '#ffffff',
  boundaryOpacity = 0.7,
  cursorDistance = null,
  cursorDistanceRef,
  currentLapTime = null,
  currentLapNumber = null,
  deltaTime = null,
  onDistanceHover,
  className,
  viewBox: externalViewBox,
  onViewBoxChange,
}: TrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const dynamicRef = useRef<HTMLCanvasElement>(null);
  const interactiveRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState({ width: 400, height: 400 });
  const [internalViewBox, setInternalViewBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDraggingCursor, setIsDraggingCursor] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const viewBox = externalViewBox ?? internalViewBox;
  const setViewBox = onViewBoxChange ?? setInternalViewBox;

  // --- ResizeObserver (debounced via rAF) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setSize({ width: Math.floor(width), height: Math.floor(height) });
          }
        }
      });
    });

    resizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  const { width, height } = size;

  // --- Data pipeline (reusing existing services) ---

  const combinedBounds = useMemo((): GeoBounds => {
    return calculateBoundsFromTrajectory(trajectory);
  }, [trajectory]);

  const transform = useMemo((): CoordinateTransform => {
    return createCoordinateTransform(combinedBounds, width, height, PADDING);
  }, [combinedBounds, width, height]);

  const worldPoints = useMemo(() => {
    return transformTrajectoryToSvg(trajectory, transform);
  }, [trajectory, transform]);

  // Pre-compute color array
  const colorArray = useMemo(() => {
    return precomputeColorArray(worldPoints, colorMode, trackColor);
  }, [worldPoints, colorMode, trackColor]);

  // Spatial index for O(1) cursor snapping
  const spatialGrid = useMemo(() => {
    return buildSpatialGrid(worldPoints);
  }, [worldPoints]);

  // Corners (async via Rust)
  const [corners, setCorners] = useState<Corner[]>([]);

  useEffect(() => {
    if (trajectory.length === 0) {
      setCorners([]);
      return;
    }

    let active = true;
    detectCorners(trajectory)
      .then((result) => {
        if (active) setCorners(result);
      })
      .catch((err) => {
        console.error('Failed to detect corners:', err);
        if (active) setCorners([]);
      });

    return () => {
      active = false;
    };
  }, [trajectory]);

  // Envelope world points (transform geo → SVG coords)
  const envelopeWorldPoints = useMemo(() => {
    if (!envelope || envelope.points.length === 0) return null;

    const inner: Point2D[] = [];
    const outer: Point2D[] = [];
    const center: Point2D[] = [];

    for (const p of envelope.points) {
      inner.push(transform.geoToSvg(p.minX, p.minY));
      outer.push(transform.geoToSvg(p.maxX, p.maxY));
      center.push(transform.geoToSvg(p.centerX, p.centerY));
    }

    return { inner, outer, center };
  }, [envelope, transform]);

  // Offset boundaries (fallback)
  const offsetBoundaries = useMemo(() => {
    if (
      envelope ||
      (computedBoundary?.leftBoundary && computedBoundary?.rightBoundary)
    ) {
      return null;
    }
    if (worldPoints.length < 2) return null;
    return generateOffsetBoundaries(worldPoints, 8);
  }, [worldPoints, envelope, computedBoundary]);

  // Cursor position with heading (interpolated between track points for smooth motion)
  const cursorPosition = useMemo(() => {
    if (cursorDistance === null || worldPoints.length < 2) return null;

    // Binary search for the segment that brackets cursorDistance
    let lo = 0;
    let hi = worldPoints.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (worldPoints[mid].distance <= cursorDistance) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const pA = worldPoints[lo];
    const pB = worldPoints[hi];
    const segLen = pB.distance - pA.distance;

    // Interpolation fraction (0..1) within the segment
    const t = segLen > 0 ? Math.max(0, Math.min(1, (cursorDistance - pA.distance) / segLen)) : 0;

    const x = pA.x + (pB.x - pA.x) * t;
    const y = pA.y + (pB.y - pA.y) * t;

    // Heading from segment direction
    const heading = Math.atan2(pB.y - pA.y, pB.x - pA.x);

    return { x, y, heading };
  }, [cursorDistance, worldPoints]);

  // Start/finish positions
  const startPosition = useMemo(() => {
    if (worldPoints.length < 2) return null;
    const dx = worldPoints[1].x - worldPoints[0].x;
    const dy = worldPoints[1].y - worldPoints[0].y;
    return {
      x: worldPoints[0].x,
      y: worldPoints[0].y,
      heading: Math.atan2(dy, dx),
    };
  }, [worldPoints]);

  const finishPosition = useMemo(() => {
    if (worldPoints.length < 2) return null;
    const last = worldPoints.length - 1;
    const dx = worldPoints[last].x - worldPoints[last - 1].x;
    const dy = worldPoints[last].y - worldPoints[last - 1].y;
    return {
      x: worldPoints[last].x,
      y: worldPoints[last].y,
      heading: Math.atan2(dy, dx),
    };
  }, [worldPoints]);

  // Camera
  const defaultCamera = useMemo(
    (): Camera => ({
      x: 0,
      y: 0,
      width,
      height,
    }),
    [width, height]
  );

  const camera: Camera = viewBox ?? defaultCamera;

  // --- Render via hook ---
  useCanvasRenderer(staticRef, dynamicRef, interactiveRef, {
    width,
    height,
    camera,
    envelopeWorldPoints,
    showEnvelope,
    computedBoundary,
    offsetBoundaries,
    showBoundaries,
    boundaryColor,
    boundaryOpacity,
    boundaryStyle,
    worldPoints,
    colors: colorArray,
    trackWidth,
    isSolidMode: colorMode === 'solid',
    trackColor,
    startPosition,
    finishPosition,
    showStartFinish,
    cursorPosition,
    cursorDistanceRef,
    isDragging: isDraggingCursor,
    corners,
    showCorners,
  });

  // --- Interaction handlers (on the interactive canvas) ---

  const getWorldCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = interactiveRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return screenToWorld(sx, sy, camera, width, height);
    },
    [camera, width, height]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const coords = getWorldCoords(e as unknown as React.MouseEvent);
      const delta = e.deltaY > 0 ? 1 + ZOOM_FACTOR : 1 - ZOOM_FACTOR;

      const newWidth = Math.max(
        width / MAX_ZOOM,
        Math.min(width / MIN_ZOOM, camera.width * delta)
      );
      const newHeight = Math.max(
        height / MAX_ZOOM,
        Math.min(height / MIN_ZOOM, camera.height * delta)
      );

      const scaleX = newWidth / camera.width;
      const scaleY = newHeight / camera.height;

      setViewBox({
        x: coords.x - (coords.x - camera.x) * scaleX,
        y: coords.y - (coords.y - camera.y) * scaleY,
        width: newWidth,
        height: newHeight,
      });
    },
    [getWorldCoords, camera, width, height, setViewBox]
  );

  const snapCursorToWorld = useCallback(
    (worldX: number, worldY: number) => {
      if (!onDistanceHover || worldPoints.length === 0) return;
      const idx = findNearestPoint(spatialGrid, worldX, worldY);
      if (idx >= 0) {
        onDistanceHover(worldPoints[idx].distance);
      }
    },
    [onDistanceHover, worldPoints, spatialGrid]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // LMB → drag cursor
        if (onDistanceHover && worldPoints.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingCursor(true);
          const coords = getWorldCoords(e);
          snapCursorToWorld(coords.x, coords.y);
        }
      } else if (e.button === 2) {
        // RMB → pan (disables follow mode)
        e.preventDefault();
        setIsPanning(true);
        setIsFollowing(false);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [getWorldCoords, onDistanceHover, worldPoints, snapCursorToWorld]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const canvas = interactiveRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = ((e.clientX - panStart.x) / rect.width) * camera.width;
        const dy = ((e.clientY - panStart.y) / rect.height) * camera.height;

        setViewBox({
          ...camera,
          x: camera.x - dx,
          y: camera.y - dy,
        });
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      if (isDraggingCursor) {
        const coords = getWorldCoords(e);
        snapCursorToWorld(coords.x, coords.y);
      }
    },
    [
      isPanning,
      isDraggingCursor,
      panStart,
      camera,
      getWorldCoords,
      snapCursorToWorld,
      setViewBox,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDraggingCursor(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDraggingCursor(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleDoubleClick = useCallback(() => {
    setViewBox(
      null as unknown as { x: number; y: number; width: number; height: number }
    );
  }, [setViewBox]);

  // Zoom button helpers
  const zoomIn = useCallback(() => {
    const newWidth = Math.max(
      width / MAX_ZOOM,
      camera.width / (1 + ZOOM_FACTOR)
    );
    const newHeight = Math.max(
      height / MAX_ZOOM,
      camera.height / (1 + ZOOM_FACTOR)
    );
    const cx = camera.x + camera.width / 2;
    const cy = camera.y + camera.height / 2;
    setViewBox({
      x: cx - newWidth / 2,
      y: cy - newHeight / 2,
      width: newWidth,
      height: newHeight,
    });
  }, [camera, width, height, setViewBox]);

  const zoomOut = useCallback(() => {
    const newWidth = Math.min(
      width / MIN_ZOOM,
      camera.width * (1 + ZOOM_FACTOR)
    );
    const newHeight = Math.min(
      height / MIN_ZOOM,
      camera.height * (1 + ZOOM_FACTOR)
    );
    const cx = camera.x + camera.width / 2;
    const cy = camera.y + camera.height / 2;
    setViewBox({
      x: cx - newWidth / 2,
      y: cy - newHeight / 2,
      width: newWidth,
      height: newHeight,
    });
  }, [camera, width, height, setViewBox]);

  const resetZoom = useCallback(() => {
    setViewBox(
      null as unknown as { x: number; y: number; width: number; height: number }
    );
  }, [setViewBox]);

  // Auto-follow: center camera on cursor when follow mode is active
  useEffect(() => {
    if (!isFollowing || !cursorPosition) return;
    setViewBox({
      x: cursorPosition.x - camera.width / 2,
      y: cursorPosition.y - camera.height / 2,
      width: camera.width,
      height: camera.height,
    });
  }, [isFollowing, cursorPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent default wheel scroll on the canvas
  useEffect(() => {
    const canvas = interactiveRef.current;
    if (!canvas) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener('wheel', prevent, { passive: false });
    return () => canvas.removeEventListener('wheel', prevent);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className ?? ''}`}
    >
      <canvas ref={staticRef} className={styles.canvas} />
      <canvas ref={dynamicRef} className={styles.canvas} />
      <canvas
        ref={interactiveRef}
        className={`${styles.canvasInteractive} ${isPanning ? styles.canvasPanning : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />

      {currentLapTime !== null && (
        <div className={styles.lapTimeDisplay}>
          <div className={styles.lapInfo}>
            {currentLapNumber !== null && (
              <span className={styles.lapNumber}>L {currentLapNumber}</span>
            )}
            <span className={styles.time}>{formatLapTime(currentLapTime)}</span>
          </div>
          {deltaTime !== null && deltaTime !== 0 && (
            <div
              className={`${styles.delta} ${deltaTime > 0 ? styles.slow : styles.fast}`}
            >
              {formatDelta(deltaTime)}
            </div>
          )}
        </div>
      )}

      <div className={styles.controls}>
        <button className={styles.zoomButton} onClick={zoomIn} title="Zoom in">
          +
        </button>
        <button
          className={styles.zoomButton}
          onClick={zoomOut}
          title="Zoom out"
        >
          -
        </button>
        <button
          className={styles.zoomButton}
          onClick={resetZoom}
          title="Reset view"
        >
          R
        </button>
        <button
          className={`${styles.zoomButton} ${isFollowing ? styles.followActive : ''}`}
          onClick={() => setIsFollowing((f) => !f)}
          title={isFollowing ? 'Stop following car' : 'Follow car'}
        >
          <Crosshair size={16} />
        </button>
      </div>
    </div>
  );
}

export default TrackCanvas;
