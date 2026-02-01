import type { Camera } from '../utils/canvasTransform';
import { applyCamera, worldToScreen } from '../utils/canvasTransform';
import type { Corner } from '../../../../types';

interface PointWithHeading {
  x: number;
  y: number;
  heading: number;
}

interface WorldPoint {
  x: number;
  y: number;
}

export interface InteractiveLayerOptions {
  camera: Camera;
  canvasW: number;
  canvasH: number;
  // Start/finish lines
  startPosition?: PointWithHeading | null;
  finishPosition?: PointWithHeading | null;
  showStartFinish: boolean;
  trackWidth: number;
  // Corners
  corners: Corner[];
  worldPoints: WorldPoint[];
  showCorners: boolean;
}

export function drawInteractiveLayer(
  ctx: CanvasRenderingContext2D,
  options: InteractiveLayerOptions
): void {
  const { camera, canvasW, canvasH } = options;

  // Clear (transparent)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvasW * dpr, canvasH * dpr);
  ctx.restore();

  // --- World-space drawing (lines, markers) ---
  ctx.save();
  applyCamera(ctx, camera, canvasW, canvasH);

  const lineHalfWidth = options.trackWidth * 2.5;

  // Start line (green)
  if (options.showStartFinish && options.startPosition) {
    drawPerpendicularLine(
      ctx,
      options.startPosition,
      lineHalfWidth,
      '#00ff00',
      2
    );
  }

  // Finish line (red)
  if (options.showStartFinish && options.finishPosition) {
    drawPerpendicularLine(
      ctx,
      options.finishPosition,
      lineHalfWidth,
      '#ff0000',
      2
    );
  }

  // Corner apex markers (crosshairs in world space)
  if (
    options.showCorners &&
    options.corners.length > 0 &&
    options.worldPoints.length > 0
  ) {
    for (const corner of options.corners) {
      const apex = options.worldPoints[corner.apexIndex];
      if (!apex) continue;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;

      // Circle
      ctx.beginPath();
      ctx.arc(apex.x, apex.y, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(apex.x - 6, apex.y);
      ctx.lineTo(apex.x + 6, apex.y);
      ctx.moveTo(apex.x, apex.y - 6);
      ctx.lineTo(apex.x, apex.y + 6);
      ctx.stroke();
    }
  }

  ctx.restore();

  // --- Screen-space drawing (labels) ---
  if (
    options.showCorners &&
    options.corners.length > 0 &&
    options.worldPoints.length > 0
  ) {
    ctx.save();
    // Reset to identity (screen-space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dprs = window.devicePixelRatio || 1;
    ctx.scale(dprs, dprs);

    for (const corner of options.corners) {
      const apex = options.worldPoints[corner.apexIndex];
      if (!apex) continue;

      const screen = worldToScreen(apex.x, apex.y, camera, canvasW, canvasH);
      const lx = screen.x + 10;
      const ly = screen.y - 10;

      // Label background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(lx, ly - 14, 30, 18);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`T${corner.id}`, lx + 15, ly);
    }

    ctx.restore();
  }
}

function drawPerpendicularLine(
  ctx: CanvasRenderingContext2D,
  point: PointWithHeading,
  halfWidth: number,
  color: string,
  lineWidth: number
): void {
  const perpAngle = point.heading + Math.PI / 2;
  const x1 = point.x - Math.cos(perpAngle) * halfWidth;
  const y1 = point.y - Math.sin(perpAngle) * halfWidth;
  const x2 = point.x + Math.cos(perpAngle) * halfWidth;
  const y2 = point.y + Math.sin(perpAngle) * halfWidth;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}
