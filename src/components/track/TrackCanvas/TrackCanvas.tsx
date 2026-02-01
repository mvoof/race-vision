import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import { Crosshair } from 'lucide-react';
import type {
  TrajectoryPoint,
  ComputedTrackBoundary,
  TrackBoundaryEnvelope,
  TrackViewData,
  OffsetBoundaries,
  EnvelopeWorldPoints,
} from '../../../types';
import {
  prepareTrackView,
  findNearestPoint as findNearestPointRust,
  transformEnvelopePoints,
  generateOffsetBoundaries as generateOffsetBoundariesRust,
  interpolateCursorPosition as interpolateCursorPositionRust,
} from '../../../services/tauri/commands';
import { useTrackViewStore } from '../../../stores/trackViewStore';
import { useBoundaryStore } from '../../../stores/boundaryStore';
import { screenToWorld } from './utils/canvasTransform';
import type { Camera } from './utils/canvasTransform';
import { useCanvasRenderer } from './useCanvasRenderer';
import styles from './TrackCanvas.module.scss';

interface TrackCanvasProps {
  trajectory: TrajectoryPoint[];
  computedBoundary?: ComputedTrackBoundary | null;
  envelope?: TrackBoundaryEnvelope | null;
  trackColor?: string;
  trackWidth?: number;
  showStartFinish?: boolean;
  showBoundaries?: boolean;
  showEnvelope?: boolean;
  showCorners?: boolean;
  boundaryStyle?: 'solid' | 'dashed';
  boundaryColor?: string;
  boundaryOpacity?: number;
  /** High-frequency cursor distance ref — updated at 60fps during playback.
   *  The cursor rAF loop reads from this ref to bypass React's render cycle. */
  cursorDistanceRef?: RefObject<number | null>;
  currentLapTime?: number | null;
  currentLapNumber?: number | null;
  deltaTime?: number | null;
  onDistanceHover?: (distance: number | null) => void;
  className?: string;
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

export function TrackCanvas({
  trajectory,
  computedBoundary,
  envelope,
  trackColor = '#4a90d9',
  trackWidth = 3,
  showStartFinish = true,
  showBoundaries = true,
  showEnvelope = true,
  showCorners = true,
  boundaryStyle = 'solid',
  boundaryColor = '#ffffff',
  boundaryOpacity = 0.7,
  cursorDistanceRef,
  currentLapTime = null,
  currentLapNumber = null,
  deltaTime = null,
  onDistanceHover,
  className,
}: TrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const dynamicRef = useRef<HTMLCanvasElement>(null);
  const interactiveRef = useRef<HTMLCanvasElement>(null);

  // Local-only state (DOM-specific, not shared)
  const [size, setSize] = useState({ width: 400, height: 400 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // ── Rust Prepared Data ──
  const [trackViewData, setTrackViewData] = useState<TrackViewData | null>(null);
  const [envelopePoints, setEnvelopePoints] = useState<EnvelopeWorldPoints | null>(null);
  const [offsets, setOffsets] = useState<OffsetBoundaries | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; heading: number } | null>(null);

  // ── Store state ──
  const viewBox = useTrackViewStore((s) => s.viewBox);
  const setViewBox = useTrackViewStore((s) => s.setViewBox);
  const isFollowing = useTrackViewStore((s) => s.isFollowing);
  const setIsFollowing = useTrackViewStore((s) => s.setIsFollowing);
  const toggleFollowing = useTrackViewStore((s) => s.toggleFollowing);
  const isPanning = useTrackViewStore((s) => s.isPanning);
  const setIsPanning = useTrackViewStore((s) => s.setIsPanning);
  const isDraggingCursor = useTrackViewStore((s) => s.isDraggingCursor);
  const setIsDraggingCursor = useTrackViewStore((s) => s.setIsDraggingCursor);
  const colorMode = useTrackViewStore((s) => s.colorMode);
  const cursorDistance = useTrackViewStore((s) => s.cursorDistance);

  const corners = useBoundaryStore((s) => s.corners);
  const setCorners = useBoundaryStore((s) => s.setCorners);

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

  // --- Data pipeline (Rust backend) ---

  // Prepare main track view data
  useEffect(() => {
    if (trajectory.length === 0 || width === 0 || height === 0) {
      setTrackViewData(null);
      return;
    }

    let active = true;
    prepareTrackView(trajectory, width, height, PADDING, colorMode, trackColor)
      .then(data => {
        if (active) setTrackViewData(data);
      })
      .catch(err => console.error('Failed to prepare track view:', err));

    return () => { active = false; };
  }, [trajectory, width, height, colorMode, trackColor]);

  // Corners (async via Rust) — stored in boundaryStore
  useEffect(() => {
    if (trajectory.length === 0) {
      setCorners([]);
      return;
    }

    // Reuse detectCorners from services (already calls Rust analyze_corners)
    import('../../../services/tauri/commands').then(({ analyzeCorners }) => {
      analyzeCorners(trajectory)
        .then((result) => setCorners(result))
        .catch((err) => console.error('Failed to detect corners:', err));
    });
  }, [trajectory, setCorners]);

  // Envelope world points (Rust backend)
  useEffect(() => {
    if (!envelope || envelope.points.length === 0 || !trackViewData) {
      setEnvelopePoints(null);
      return;
    }

    let active = true;
    transformEnvelopePoints(
      envelope.points,
      trackViewData.bounds.minLon,
      trackViewData.bounds.minLat,
      trackViewData.bounds.maxLat,
      width,
      height,
      PADDING,
      trackViewData.scale,
      trackViewData.offsetX,
      trackViewData.offsetY
    ).then(res => {
      if (active) setEnvelopePoints(res);
    });

    return () => { active = false; };
  }, [envelope, trackViewData, width, height]);

  // Offset boundaries (Rust backend)
  useEffect(() => {
    if (envelope || (computedBoundary?.leftBoundary && computedBoundary?.rightBoundary) || !trackViewData) {
      setOffsets(null);
      return;
    }

    let active = true;
    generateOffsetBoundariesRust(trackViewData.worldPoints, 8)
      .then(res => {
        if (active) setOffsets(res);
      });

    return () => { active = false; };
  }, [trackViewData, envelope, computedBoundary]);

  // Cursor position (Rust backend)
  useEffect(() => {
    if (cursorDistance === null || !trackViewData || trackViewData.worldPoints.length < 2) {
      setCursorPos(null);
      return;
    }

    let active = true;
    interpolateCursorPositionRust(trackViewData.worldPoints, cursorDistance)
      .then(pos => {
        if (active) setCursorPos(pos);
      });

    return () => { active = false; };
  }, [cursorDistance, trackViewData]);

  // Start/finish positions (memoized from trackViewData)
  const startPosition = useMemo(() => {
    const pts = trackViewData?.worldPoints;
    if (!pts || pts.length < 2) return null;
    return {
      x: pts[0].x,
      y: pts[0].y,
      heading: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
    };
  }, [trackViewData]);

  const finishPosition = useMemo(() => {
    const pts = trackViewData?.worldPoints;
    if (!pts || pts.length < 2) return null;
    const last = pts.length - 1;
    return {
      x: pts[last].x,
      y: pts[last].y,
      heading: Math.atan2(pts[last].y - pts[last - 1].y, pts[last].x - pts[last - 1].x),
    };
  }, [trackViewData]);

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

  // Follow-cam callback: centers camera on car position from the rAF loop
  const handleCameraFollow = useCallback(
    (vb: { x: number; y: number; width: number; height: number }) => {
      setViewBox(vb);
    },
    [setViewBox]
  );

  // --- Render via hook ---
  useCanvasRenderer(staticRef, dynamicRef, interactiveRef, {
    width,
    height,
    camera,
    envelopeWorldPoints: envelopePoints,
    showEnvelope,
    computedBoundary,
    offsetBoundaries: offsets,
    showBoundaries,
    boundaryColor,
    boundaryOpacity,
    boundaryStyle,
    worldPoints: trackViewData?.worldPoints ?? [],
    colors: trackViewData?.colors ?? [],
    trackWidth,
    isSolidMode: colorMode === 'solid',
    trackColor,
    startPosition,
    finishPosition,
    showStartFinish,
    cursorPosition: cursorPos,
    cursorDistanceRef,
    isDragging: isDraggingCursor,
    corners,
    showCorners,
    isFollowing,
    onCameraFollow: handleCameraFollow,
  });

  // --- Interaction handlers ---

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
    async (worldX: number, worldY: number) => {
      if (!onDistanceHover || !trackViewData) return;
      const idx = await findNearestPointRust(trackViewData.worldPoints, worldX, worldY);
      if (idx >= 0) {
        onDistanceHover(trackViewData.worldPoints[idx].distance);
      }
    },
    [onDistanceHover, trackViewData]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // LMB → drag cursor
        if (onDistanceHover && trackViewData) {
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
    [getWorldCoords, onDistanceHover, trackViewData, snapCursorToWorld, setIsDraggingCursor, setIsPanning, setIsFollowing]
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
  }, [setIsPanning, setIsDraggingCursor]);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDraggingCursor(false);
  }, [setIsPanning, setIsDraggingCursor]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleDoubleClick = useCallback(() => {
    setViewBox(null);
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
    setViewBox(null);
  }, [setViewBox]);

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
          onClick={toggleFollowing}
          title={isFollowing ? 'Stop following car' : 'Follow car'}
        >
          <Crosshair size={16} />
        </button>
      </div>
    </div>
  );
}

export default TrackCanvas;
