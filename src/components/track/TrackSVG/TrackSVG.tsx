import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from 'react';
import type {
  TrajectoryPoint,
  CoordinateTransform,
  GeoBounds,
  ComputedTrackBoundary,
} from '../../../types';
import {
  createCoordinateTransform,
  transformTrajectoryToSvg,
  calculateBoundsFromTrajectory,
} from '../../../services/track';
import { RacingLine, type ColorMode } from './RacingLine';
import { TrackBoundaries } from './TrackBoundaries';
import { TrackMarkers } from './TrackMarkers';
import styles from './TrackSVG.module.scss';

interface TrackSVGProps {
  trajectory: TrajectoryPoint[];
  // Computed boundary from Frenet algorithm (optional)
  computedBoundary?: ComputedTrackBoundary | null;
  colorMode?: ColorMode;
  trackColor?: string;
  trackWidth?: number;
  showStartFinish?: boolean;
  showBoundaries?: boolean;
  boundaryStyle?: 'solid' | 'dashed';
  boundaryColor?: string;
  boundaryOpacity?: number;
  cursorDistance?: number | null;
  onDistanceHover?: (distance: number | null) => void;
  className?: string;
  // Zoom/Pan state (controlled externally)
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

export function TrackSVG({
  trajectory,
  computedBoundary,
  colorMode = 'speed',
  trackColor = '#4a90d9',
  trackWidth = 4,
  showStartFinish = true,
  showBoundaries = true,
  boundaryStyle = 'dashed',
  boundaryColor = '#666666',
  boundaryOpacity = 0.7,
  cursorDistance = null,
  onDistanceHover,
  className,
  viewBox: externalViewBox,
  onViewBoxChange,
}: TrackSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 400, height: 400 });
  const [internalViewBox, setInternalViewBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Use external or internal viewBox
  const viewBox = externalViewBox ?? internalViewBox;
  const setViewBox = onViewBoxChange ?? setInternalViewBox;

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

  // Calculate bounds from trajectory
  const combinedBounds = useMemo((): GeoBounds => {
    return calculateBoundsFromTrajectory(trajectory);
  }, [trajectory]);

  // Create coordinate transform
  const transform = useMemo((): CoordinateTransform => {
    return createCoordinateTransform(combinedBounds, width, height, PADDING);
  }, [combinedBounds, width, height]);

  // Transform trajectory to SVG coordinates
  const svgPoints = useMemo(() => {
    const points = transformTrajectoryToSvg(trajectory, transform);
    // Debug logging
    if (trajectory.length > 0) {
      console.log('TrackSVG Debug:', {
        trajectoryCount: trajectory.length,
        firstTrajectory: trajectory[0],
        lastTrajectory: trajectory[trajectory.length - 1],
        svgPointsCount: points.length,
        firstSvgPoint: points[0],
        lastSvgPoint: points[points.length - 1],
        combinedBounds,
        transform: {
          scale: transform.scale,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
        },
        svgSize: { width, height },
      });
    }
    return points;
  }, [trajectory, transform, combinedBounds, width, height]);

  // Calculate min/max speed for color mapping
  const { minSpeed, maxSpeed } = useMemo(() => {
    if (svgPoints.length === 0) return { minSpeed: 0, maxSpeed: 100 };
    const speeds = svgPoints.map((p) => p.speed);
    return {
      minSpeed: Math.min(...speeds),
      maxSpeed: Math.max(...speeds),
    };
  }, [svgPoints]);

  // Find point by distance
  const findPointByDistance = useCallback(
    (distance: number): { x: number; y: number } | null => {
      for (let i = 0; i < svgPoints.length; i++) {
        if (svgPoints[i].distance >= distance) {
          return { x: svgPoints[i].x, y: svgPoints[i].y };
        }
      }
      if (svgPoints.length > 0) {
        const last = svgPoints[svgPoints.length - 1];
        return { x: last.x, y: last.y };
      }
      return null;
    },
    [svgPoints]
  );

  // Cursor position
  const cursorPosition = useMemo(() => {
    if (cursorDistance === null) return undefined;
    return findPointByDistance(cursorDistance) ?? undefined;
  }, [cursorDistance, findPointByDistance]);

  // Start/finish position
  const startFinishPosition = useMemo(() => {
    if (svgPoints.length === 0) return undefined;
    return { x: svgPoints[0].x, y: svgPoints[0].y };
  }, [svgPoints]);

  // Default viewBox
  const defaultViewBox = useMemo(
    () => ({
      x: 0,
      y: 0,
      width,
      height,
    }),
    [width, height]
  );

  const currentViewBox = viewBox ?? defaultViewBox;

  // Get SVG coordinates from mouse event
  const getSvgCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      const rect = svg.getBoundingClientRect();
      const x =
        ((e.clientX - rect.left) / rect.width) * currentViewBox.width +
        currentViewBox.x;
      const y =
        ((e.clientY - rect.top) / rect.height) * currentViewBox.height +
        currentViewBox.y;

      return { x, y };
    },
    [currentViewBox]
  );

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const coords = getSvgCoords(e as unknown as React.MouseEvent);
      const delta = e.deltaY > 0 ? 1 + ZOOM_FACTOR : 1 - ZOOM_FACTOR;

      const newWidth = Math.max(
        width / MAX_ZOOM,
        Math.min(width / MIN_ZOOM, currentViewBox.width * delta)
      );
      const newHeight = Math.max(
        height / MAX_ZOOM,
        Math.min(height / MIN_ZOOM, currentViewBox.height * delta)
      );

      // Zoom toward mouse position
      const scaleX = newWidth / currentViewBox.width;
      const scaleY = newHeight / currentViewBox.height;

      const newX = coords.x - (coords.x - currentViewBox.x) * scaleX;
      const newY = coords.y - (coords.y - currentViewBox.y) * scaleY;

      setViewBox({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    },
    [getSvgCoords, currentViewBox, width, height, setViewBox]
  );

  // Handle mouse down for panning (left click)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click for panning
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Handle mouse move for panning and hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const dx =
          ((e.clientX - panStart.x) / rect.width) * currentViewBox.width;
        const dy =
          ((e.clientY - panStart.y) / rect.height) * currentViewBox.height;

        setViewBox({
          ...currentViewBox,
          x: currentViewBox.x - dx,
          y: currentViewBox.y - dy,
        });

        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Handle hover for distance
      if (!onDistanceHover) return;

      const coords = getSvgCoords(e);

      if (svgPoints.length === 0) {
        onDistanceHover(null);
        return;
      }

      // Find closest point
      let closestIdx = 0;
      let closestDist = Infinity;

      for (let i = 0; i < svgPoints.length; i++) {
        const dx = svgPoints[i].x - coords.x;
        const dy = svgPoints[i].y - coords.y;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      // Scale threshold by zoom level
      const threshold = 20 * (currentViewBox.width / width);
      if (Math.sqrt(closestDist) < threshold) {
        onDistanceHover(svgPoints[closestIdx].distance);
      } else {
        onDistanceHover(null);
      }
    },
    [
      isPanning,
      panStart,
      currentViewBox,
      svgPoints,
      onDistanceHover,
      getSvgCoords,
      setViewBox,
      width,
    ]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    if (onDistanceHover) {
      onDistanceHover(null);
    }
  }, [onDistanceHover]);

  // Prevent context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Reset view on double click
  const handleDoubleClick = useCallback(() => {
    setViewBox(
      null as unknown as { x: number; y: number; width: number; height: number }
    );
  }, [setViewBox]);

  const viewBoxString = `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className ?? ''}`}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={viewBoxString}
        className={`${styles.svg} ${isPanning ? styles.svgPanning : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background */}
        <rect
          x={currentViewBox.x}
          y={currentViewBox.y}
          width={currentViewBox.width}
          height={currentViewBox.height}
          fill="#0f0f23"
        />

        {/* Track boundaries (Frenet computed or offset from trajectory) */}
        {showBoundaries && svgPoints.length > 0 && (
          <TrackBoundaries
            computedBoundary={computedBoundary}
            svgPoints={svgPoints}
            strokeColor={boundaryColor}
            strokeWidth={1}
            opacity={boundaryOpacity}
            style={boundaryStyle}
            offsetDistance={8}
          />
        )}

        {/* Racing line (telemetry trajectory) */}
        <RacingLine
          points={svgPoints}
          colorMode={colorMode}
          trackColor={trackColor}
          trackWidth={trackWidth}
          minSpeed={minSpeed}
          maxSpeed={maxSpeed}
        />

        {/* Markers (start/finish, cursor) */}
        <TrackMarkers
          startFinish={startFinishPosition}
          cursorPosition={cursorPosition}
          showStartFinish={showStartFinish}
          showCursor={cursorDistance !== null}
        />
      </svg>

      {/* Zoom controls */}
      <div className={styles.controls}>
        <button
          className={styles.zoomButton}
          onClick={() => {
            const newWidth = Math.max(
              width / MAX_ZOOM,
              currentViewBox.width / (1 + ZOOM_FACTOR)
            );
            const newHeight = Math.max(
              height / MAX_ZOOM,
              currentViewBox.height / (1 + ZOOM_FACTOR)
            );
            const centerX = currentViewBox.x + currentViewBox.width / 2;
            const centerY = currentViewBox.y + currentViewBox.height / 2;
            setViewBox({
              x: centerX - newWidth / 2,
              y: centerY - newHeight / 2,
              width: newWidth,
              height: newHeight,
            });
          }}
          title="Zoom in"
        >
          +
        </button>
        <button
          className={styles.zoomButton}
          onClick={() => {
            const newWidth = Math.min(
              width / MIN_ZOOM,
              currentViewBox.width * (1 + ZOOM_FACTOR)
            );
            const newHeight = Math.min(
              height / MIN_ZOOM,
              currentViewBox.height * (1 + ZOOM_FACTOR)
            );
            const centerX = currentViewBox.x + currentViewBox.width / 2;
            const centerY = currentViewBox.y + currentViewBox.height / 2;
            setViewBox({
              x: centerX - newWidth / 2,
              y: centerY - newHeight / 2,
              width: newWidth,
              height: newHeight,
            });
          }}
          title="Zoom out"
        >
          -
        </button>
        <button
          className={styles.zoomButton}
          onClick={() =>
            setViewBox(
              null as unknown as {
                x: number;
                y: number;
                width: number;
                height: number;
              }
            )
          }
          title="Reset view"
        >
          R
        </button>
      </div>
    </div>
  );
}

export default TrackSVG;
