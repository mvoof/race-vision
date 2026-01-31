import type { Camera } from '../utils/canvasTransform';
import { applyCamera } from '../utils/canvasTransform';

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
  // No clearRect here — caller is responsible for clearing (e.g. drawInteractiveLayer).
  if (!options.cursorPosition) return;

  const cp = options.cursorPosition;

  ctx.save();
  applyCamera(ctx, options.camera, options.canvasW, options.canvasH);

  // Glow
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 152, 0, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Main circle
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9800';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Direction indicator
  if (cp.heading !== undefined) {
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y);
    ctx.lineTo(
      cp.x + Math.cos(cp.heading) * 15,
      cp.y + Math.sin(cp.heading) * 15
    );
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.restore();
}
