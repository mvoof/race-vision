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

// Car body dimensions in world units
const CAR_LENGTH = 20;
const CAR_WIDTH = 10;
// Wheel dimensions in world units
const WHEEL_LENGTH = 5;
const WHEEL_WIDTH = 2.5;
// Minimum screen size (px) before falling back to simple dot
const MIN_SCREEN_SIZE = 8;

export function drawCursorLayer(
  ctx: CanvasRenderingContext2D,
  options: CursorLayerOptions
): void {
  // No clearRect here — caller is responsible for clearing (e.g. drawInteractiveLayer).
  if (!options.cursorPosition) return;

  const cp = options.cursorPosition;

  // Compute car screen size to decide rendering mode
  const scaleX = options.canvasW / options.camera.width;
  const carScreenSize = CAR_LENGTH * scaleX;

  ctx.save();
  applyCamera(ctx, options.camera, options.canvasW, options.canvasH);

  if (carScreenSize < MIN_SCREEN_SIZE) {
    // Fallback: simple dot when zoomed out too far
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9800';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Schematic top-down car
  ctx.translate(cp.x, cp.y);
  ctx.rotate(cp.heading);

  const halfL = CAR_LENGTH / 2;
  const halfW = CAR_WIDTH / 2;
  const whw = WHEEL_WIDTH / 2;

  // Body outline — 1px white stroke
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(-halfL, -halfW, CAR_LENGTH, CAR_WIDTH);

  // 4 Wheels — orange filled small rectangles at corners
  ctx.fillStyle = '#ff9800';

  // Front-left
  ctx.fillRect(halfL - WHEEL_LENGTH + 1, -halfW - whw, WHEEL_LENGTH, WHEEL_WIDTH);
  // Front-right
  ctx.fillRect(halfL - WHEEL_LENGTH + 1, halfW - whw, WHEEL_LENGTH, WHEEL_WIDTH);
  // Rear-left
  ctx.fillRect(-halfL, -halfW - whw, WHEEL_LENGTH, WHEEL_WIDTH);
  // Rear-right
  ctx.fillRect(-halfL, halfW - whw, WHEEL_LENGTH, WHEEL_WIDTH);

  // Front direction indicator — small triangle at front center
  ctx.beginPath();
  ctx.moveTo(halfL + 3, 0);
  ctx.lineTo(halfL - 2, -3);
  ctx.lineTo(halfL - 2, 3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();

  ctx.restore();
}
