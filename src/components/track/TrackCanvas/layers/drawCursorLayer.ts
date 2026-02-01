import type { Camera } from '../utils/canvasTransform';
import { worldToScreen } from '../utils/canvasTransform';

interface PointWithHeading {
  x: number;
  y: number;
  heading: number;
}

export interface CursorLayerOptions {
  camera: Camera;
  canvasW: number;
  canvasH: number;
  cursorPosition?: PointWithHeading | null;
  isDragging: boolean;
}

export function drawCursorLayer(
  ctx: CanvasRenderingContext2D,
  options: CursorLayerOptions
): void {
  if (!options.cursorPosition) return;

  const { camera, canvasW, canvasH } = options;
  const cp = options.cursorPosition;
  
  // Calculate screen position for fixed-size rendering
  const screenPos = worldToScreen(cp.x, cp.y, camera, canvasW, canvasH);
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  // Reset to screen coordinates (scaled by DPR)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Simple white circle
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  
  // Optional: subtle shadow for better visibility on light tracks
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.stroke(); // Stroke not strictly needed if fill is white, but helps contrast

  ctx.restore();
}
