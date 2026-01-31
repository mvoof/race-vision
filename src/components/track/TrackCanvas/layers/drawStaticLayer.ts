import type { Camera } from '../utils/canvasTransform';
import { applyCamera } from '../utils/canvasTransform';
import type { Point2D, ComputedTrackBoundary } from '../../../../types';

interface EnvelopeWorldPoints {
  inner: Point2D[];
  outer: Point2D[];
  center: Point2D[];
}

export interface StaticLayerOptions {
  camera: Camera;
  canvasW: number;
  canvasH: number;
  // Envelope boundaries (from all telemetries)
  envelopeWorldPoints?: EnvelopeWorldPoints | null;
  showEnvelope: boolean;
  envelopeColor: string;
  envelopeOpacity: number;
  // Frenet-computed boundaries (fallback)
  computedBoundary?: ComputedTrackBoundary | null;
  // Offset boundaries from trajectory
  offsetBoundaries?: { left: Point2D[]; right: Point2D[] } | null;
  showBoundaries: boolean;
  boundaryColor: string;
  boundaryOpacity: number;
  boundaryStyle: 'solid' | 'dashed';
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  color: string,
  lineWidth: number,
  opacity: number,
  dashed: boolean = false
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (dashed) {
    ctx.setLineDash([4, 2]);
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  options: StaticLayerOptions
): void {
  const { camera, canvasW, canvasH } = options;

  // Clear with background color
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvasW * dpr, canvasH * dpr);
  ctx.restore();

  ctx.save();
  applyCamera(ctx, camera, canvasW, canvasH);

  // Draw envelope boundaries (from all telemetries)
  if (options.showEnvelope && options.envelopeWorldPoints) {
    const ep = options.envelopeWorldPoints;
    // Inner boundary (dashed green)
    drawPolyline(
      ctx,
      ep.inner,
      options.envelopeColor,
      1.5,
      options.envelopeOpacity,
      true
    );
    // Outer boundary (dashed green)
    drawPolyline(
      ctx,
      ep.outer,
      options.envelopeColor,
      1.5,
      options.envelopeOpacity,
      true
    );
    // Center line (thin white dashed)
    drawPolyline(
      ctx,
      ep.center,
      '#ffffff',
      0.75,
      options.envelopeOpacity * 0.5,
      true
    );
  }

  // Draw Frenet-computed or offset boundaries (only if no envelope)
  if (options.showBoundaries && !options.envelopeWorldPoints) {
    const isDashed = options.boundaryStyle === 'dashed';

    if (
      options.computedBoundary?.leftBoundary &&
      options.computedBoundary?.rightBoundary
    ) {
      drawPolyline(
        ctx,
        options.computedBoundary.leftBoundary,
        options.boundaryColor,
        1,
        options.boundaryOpacity,
        isDashed
      );
      drawPolyline(
        ctx,
        options.computedBoundary.rightBoundary,
        options.boundaryColor,
        1,
        options.boundaryOpacity,
        isDashed
      );
    } else if (options.offsetBoundaries) {
      drawPolyline(
        ctx,
        options.offsetBoundaries.left,
        options.boundaryColor,
        1,
        options.boundaryOpacity,
        isDashed
      );
      drawPolyline(
        ctx,
        options.offsetBoundaries.right,
        options.boundaryColor,
        1,
        options.boundaryOpacity,
        isDashed
      );
    }
  }

  ctx.restore();
}
