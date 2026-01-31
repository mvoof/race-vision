/**
 * Camera represents the visible region of the world in world-coordinates.
 * Mirrors the SVG viewBox concept: { x, y, width, height }.
 */
export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Apply the camera transform to a 2D canvas context.
 * After calling this, all subsequent drawing commands use world-coordinates.
 */
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasW: number,
  canvasH: number
): void {
  const scaleX = canvasW / camera.width;
  const scaleY = canvasH / camera.height;
  ctx.setTransform(
    scaleX,
    0,
    0,
    scaleY,
    -camera.x * scaleX,
    -camera.y * scaleY
  );
}

/**
 * Convert screen (CSS pixel) coordinates to world coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  return {
    x: (screenX / canvasW) * camera.width + camera.x,
    y: (screenY / canvasH) * camera.height + camera.y,
  };
}

/**
 * Convert world coordinates to screen (CSS pixel) coordinates.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  return {
    x: ((worldX - camera.x) / camera.width) * canvasW,
    y: ((worldY - camera.y) / camera.height) * canvasH,
  };
}

/**
 * Compute a default camera that shows all points with the given padding.
 */
export function getDefaultCamera(canvasW: number, canvasH: number): Camera {
  return { x: 0, y: 0, width: canvasW, height: canvasH };
}
