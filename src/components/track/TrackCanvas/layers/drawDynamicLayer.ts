import type { Camera } from '../utils/canvasTransform';
import { applyCamera } from '../utils/canvasTransform';

interface WorldPoint {
  x: number;
  y: number;
}

export interface DynamicLayerOptions {
  camera: Camera;
  canvasW: number;
  canvasH: number;
  worldPoints: WorldPoint[];
  /** Pre-computed color per segment (length = worldPoints.length - 1) */
  colors: string[];
  trackWidth: number;
  isSolidMode: boolean;
  trackColor: string;
}

export function drawDynamicLayer(
  ctx: CanvasRenderingContext2D,
  options: DynamicLayerOptions
): void {
  const {
    camera,
    canvasW,
    canvasH,
    worldPoints,
    colors,
    trackWidth,
    isSolidMode,
    trackColor,
  } = options;

  // Clear (transparent)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvasW * dpr, canvasH * dpr);
  ctx.restore();

  if (worldPoints.length < 2) return;

  ctx.save();
  applyCamera(ctx, camera, canvasW, canvasH);

  // 1. Draw background stroke (dark, wider) — single path
  ctx.beginPath();
  ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
  for (let i = 1; i < worldPoints.length; i++) {
    ctx.lineTo(worldPoints[i].x, worldPoints[i].y);
  }
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = trackWidth + 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // 2. Draw colored segments
  if (isSolidMode) {
    // Single color — one draw call
    ctx.beginPath();
    ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
    for (let i = 1; i < worldPoints.length; i++) {
      ctx.lineTo(worldPoints[i].x, worldPoints[i].y);
    }
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = trackWidth;
    ctx.stroke();
  } else {
    // Per-segment coloring
    ctx.lineWidth = trackWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      ctx.moveTo(worldPoints[i].x, worldPoints[i].y);
      ctx.lineTo(worldPoints[i + 1].x, worldPoints[i + 1].y);
      ctx.strokeStyle = colors[i];
      ctx.stroke();
    }
  }

  ctx.restore();
}
