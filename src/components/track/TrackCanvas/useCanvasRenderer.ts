import { useEffect, useRef, type RefObject } from 'react';
import { setupHiDpiCanvas } from './utils/hiDpiUtils';
import {
  drawStaticLayer,
  type StaticLayerOptions,
} from './layers/drawStaticLayer';
import {
  drawDynamicLayer,
  type DynamicLayerOptions,
} from './layers/drawDynamicLayer';
import { drawInteractiveLayer } from './layers/drawInteractiveLayer';
import { drawCursorLayer } from './layers/drawCursorLayer';
import type { Camera } from './utils/canvasTransform';
import type { Point2D, ComputedTrackBoundary, Corner } from '../../../types';

interface EnvelopeWorldPoints {
  inner: Point2D[];
  outer: Point2D[];
  center: Point2D[];
}

interface PointWithHeading {
  x: number;
  y: number;
  heading: number;
}

interface WorldPoint {
  x: number;
  y: number;
}

export interface CanvasRendererOptions {
  // Size
  width: number;
  height: number;
  // Camera
  camera: Camera;
  // Static layer deps
  envelopeWorldPoints: EnvelopeWorldPoints | null;
  showEnvelope: boolean;
  computedBoundary?: ComputedTrackBoundary | null;
  offsetBoundaries: { left: Point2D[]; right: Point2D[] } | null;
  showBoundaries: boolean;
  boundaryColor: string;
  boundaryOpacity: number;
  boundaryStyle: 'solid' | 'dashed';
  // Dynamic layer deps
  worldPoints: WorldPoint[];
  colors: string[];
  trackWidth: number;
  isSolidMode: boolean;
  trackColor: string;
  // Interactive layer deps
  startPosition: PointWithHeading | null;
  finishPosition: PointWithHeading | null;
  showStartFinish: boolean;
  cursorPosition: PointWithHeading | null;
  /** High-frequency cursor distance ref (60fps). When provided, the cursor
   *  rAF loop computes its own position from this ref + worldPoints instead
   *  of relying on the React-provided `cursorPosition`. */
  cursorDistanceRef?: RefObject<number | null>;
  isDragging: boolean;
  corners: Corner[];
  showCorners: boolean;
}

/**
 * Hook that manages the 4-canvas rendering lifecycle.
 *
 * Layers (bottom → top):
 *  1. Static      – boundaries, envelope (redraws on camera/data change)
 *  2. Dynamic     – colored track line (redraws on camera/color change)
 *  3. Interactive  – corners, start/finish markers (redraws on corner/marker change)
 *  4. Cursor       – car cursor only (rAF-driven for maximum smoothness)
 *
 * The cursor is drawn on the interactive canvas via a persistent rAF loop
 * that redraws corners + cursor together. This keeps compositing cost low
 * (3 canvases instead of 4) while maintaining 60fps cursor motion.
 */
export function useCanvasRenderer(
  staticRef: RefObject<HTMLCanvasElement | null>,
  dynamicRef: RefObject<HTMLCanvasElement | null>,
  interactiveRef: RefObject<HTMLCanvasElement | null>,
  opts: CanvasRendererOptions
): void {
  const { width, height } = opts;

  // === Static layer ===
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas || width === 0 || height === 0) return;

    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    const layerOpts: StaticLayerOptions = {
      camera: opts.camera,
      canvasW: width,
      canvasH: height,
      envelopeWorldPoints: opts.envelopeWorldPoints,
      showEnvelope: opts.showEnvelope,
      envelopeColor: '#00ff00',
      envelopeOpacity: 0.6,
      computedBoundary: opts.computedBoundary,
      offsetBoundaries: opts.offsetBoundaries,
      showBoundaries: opts.showBoundaries,
      boundaryColor: opts.boundaryColor,
      boundaryOpacity: opts.boundaryOpacity,
      boundaryStyle: opts.boundaryStyle,
    };

    drawStaticLayer(ctx, layerOpts);
  }, [
    width,
    height,
    opts.camera,
    opts.envelopeWorldPoints,
    opts.showEnvelope,
    opts.computedBoundary,
    opts.offsetBoundaries,
    opts.showBoundaries,
    opts.boundaryColor,
    opts.boundaryOpacity,
    opts.boundaryStyle,
  ]);

  // === Dynamic layer ===
  useEffect(() => {
    const canvas = dynamicRef.current;
    if (!canvas || width === 0 || height === 0) return;

    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    const layerOpts: DynamicLayerOptions = {
      camera: opts.camera,
      canvasW: width,
      canvasH: height,
      worldPoints: opts.worldPoints,
      colors: opts.colors,
      trackWidth: opts.trackWidth,
      isSolidMode: opts.isSolidMode,
      trackColor: opts.trackColor,
    };

    drawDynamicLayer(ctx, layerOpts);
  }, [
    width,
    height,
    opts.camera,
    opts.worldPoints,
    opts.colors,
    opts.trackWidth,
    opts.isSolidMode,
    opts.trackColor,
  ]);

  // === Interactive + Cursor layer (rAF-driven) ===
  // Both corners/markers AND cursor are drawn on the same canvas via a
  // persistent rAF loop. This avoids a 4th canvas (saves ~9MB compositing).
  // The rAF loop only redraws when something actually changes.

  const cursorPosRef = useRef(opts.cursorPosition);
  const isDraggingRef = useRef(opts.isDragging);
  const cameraRef = useRef(opts.camera);
  const sizeRef = useRef({ width, height });
  const worldPointsRef = useRef(opts.worldPoints);
  const extCursorDistRef = useRef(opts.cursorDistanceRef);
  const interactiveOptsRef = useRef({
    startPosition: opts.startPosition,
    finishPosition: opts.finishPosition,
    showStartFinish: opts.showStartFinish,
    trackWidth: opts.trackWidth,
    corners: opts.corners,
    showCorners: opts.showCorners,
  });

  cursorPosRef.current = opts.cursorPosition;
  isDraggingRef.current = opts.isDragging;
  cameraRef.current = opts.camera;
  sizeRef.current = { width, height };
  worldPointsRef.current = opts.worldPoints;
  extCursorDistRef.current = opts.cursorDistanceRef;
  interactiveOptsRef.current = {
    startPosition: opts.startPosition,
    finishPosition: opts.finishPosition,
    showStartFinish: opts.showStartFinish,
    trackWidth: opts.trackWidth,
    corners: opts.corners,
    showCorners: opts.showCorners,
  };

  // Setup interactive canvas size
  useEffect(() => {
    const canvas = interactiveRef.current;
    if (!canvas || width === 0 || height === 0) return;
    setupHiDpiCanvas(canvas, width, height);
  }, [width, height]);

  useEffect(() => {
    const canvas = interactiveRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let rafId = 0;
    let prevX = NaN;
    let prevY = NaN;
    let prevHeading = NaN;
    let prevDragging = false;
    let prevCamX = NaN;
    let prevCamY = NaN;

    /** Binary search + lerp for cursor position from distance. */
    const computeCursorFromDistance = (
      dist: number,
      pts: WorldPoint[]
    ): PointWithHeading | null => {
      if (pts.length < 2) return null;
      const wp = pts as { x: number; y: number; distance: number }[];

      let lo = 0;
      let hi = wp.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (wp[mid].distance <= dist) lo = mid;
        else hi = mid;
      }

      const pA = wp[lo];
      const pB = wp[hi];
      const segLen = pB.distance - pA.distance;
      const t =
        segLen > 0
          ? Math.max(0, Math.min(1, (dist - pA.distance) / segLen))
          : 0;

      return {
        x: pA.x + (pB.x - pA.x) * t,
        y: pA.y + (pB.y - pA.y) * t,
        heading: Math.atan2(pB.y - pA.y, pB.x - pA.x),
      };
    };

    const draw = () => {
      const dragging = isDraggingRef.current;
      const cam = cameraRef.current;
      const pts = worldPointsRef.current;

      // Determine cursor position — prefer high-frequency ref
      let pos: PointWithHeading | null = null;
      const distRef = extCursorDistRef.current;
      const dist = distRef?.current;
      if (dist != null && pts.length >= 2) {
        pos = computeCursorFromDistance(dist, pts);
      } else {
        pos = cursorPosRef.current;
      }

      const x = pos?.x ?? NaN;
      const y = pos?.y ?? NaN;
      const h = pos?.heading ?? NaN;

      const changed =
        x !== prevX ||
        y !== prevY ||
        h !== prevHeading ||
        dragging !== prevDragging ||
        cam.x !== prevCamX ||
        cam.y !== prevCamY;

      if (!changed) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      prevX = x;
      prevY = y;
      prevHeading = h;
      prevDragging = dragging;
      prevCamX = cam.x;
      prevCamY = cam.y;

      const w = sizeRef.current.width;
      const ht = sizeRef.current.height;

      if (w > 0 && ht > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const iOpts = interactiveOptsRef.current;

          // Draw interactive elements (corners, start/finish)
          drawInteractiveLayer(ctx, {
            camera: cam,
            canvasW: w,
            canvasH: ht,
            startPosition: iOpts.startPosition,
            finishPosition: iOpts.finishPosition,
            showStartFinish: iOpts.showStartFinish,
            trackWidth: iOpts.trackWidth,
            corners: iOpts.corners,
            worldPoints: pts,
            showCorners: iOpts.showCorners,
          });

          // Draw cursor on top
          drawCursorLayer(ctx, {
            camera: cam,
            canvasW: w,
            canvasH: ht,
            cursorPosition: pos,
            isDragging: dragging,
          });
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // Persistent rAF loop — reads all values from refs
}
