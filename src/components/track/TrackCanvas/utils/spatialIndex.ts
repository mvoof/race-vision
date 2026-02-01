interface IndexedPoint {
  x: number;
  y: number;
}

/**
 * Grid-based spatial index for O(1) amortised nearest-point lookups.
 * Works by dividing the bounding box into cells and storing point
 * indices per cell. Querying checks only the target cell + its 8 neighbours.
 */
export interface SpatialGrid {
  cells: Map<string, number[]>;
  cellSize: number;
  minX: number;
  minY: number;
  points: IndexedPoint[];
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Build a spatial grid from an array of points.
 */
export function buildSpatialGrid(points: IndexedPoint[]): SpatialGrid {
  if (points.length === 0) {
    return { cells: new Map(), cellSize: 1, minX: 0, minY: 0, points };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Choose cell size so we get ~sqrt(N) cells per dimension
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const avgRange = (rangeX + rangeY) / 2;
  const cellSize = avgRange / Math.max(1, Math.sqrt(points.length));

  const cells = new Map<string, number[]>();

  for (let i = 0; i < points.length; i++) {
    const col = Math.floor((points[i].x - minX) / cellSize);
    const row = Math.floor((points[i].y - minY) / cellSize);
    const key = cellKey(col, row);

    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(i);
  }

  return { cells, cellSize, minX, minY, points };
}

/**
 * Find the index of the nearest point to (worldX, worldY).
 * Returns -1 if the grid is empty.
 */
export function findNearestPoint(
  grid: SpatialGrid,
  worldX: number,
  worldY: number
): number {
  if (grid.points.length === 0) return -1;

  const col = Math.floor((worldX - grid.minX) / grid.cellSize);
  const row = Math.floor((worldY - grid.minY) / grid.cellSize);

  let bestIdx = -1;
  let bestDist = Infinity;

  // Search target cell + 8 neighbours (3×3 grid)
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const key = cellKey(col + dc, row + dr);
      const bucket = grid.cells.get(key);
      if (!bucket) continue;

      for (const idx of bucket) {
        const dx = grid.points[idx].x - worldX;
        const dy = grid.points[idx].y - worldY;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
    }
  }

  // Fallback: if 3×3 neighbourhood yielded nothing (very sparse), brute-force
  if (bestIdx === -1) {
    for (let i = 0; i < grid.points.length; i++) {
      const dx = grid.points[i].x - worldX;
      const dy = grid.points[i].y - worldY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}
