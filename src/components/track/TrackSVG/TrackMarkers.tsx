interface Point {
  x: number;
  y: number;
}

interface PointWithHeading extends Point {
  heading?: number; // Direction angle in radians
}

interface TrackMarkersProps {
  startFinish?: PointWithHeading;
  finishLine?: PointWithHeading;
  cursorPosition?: PointWithHeading; // Changed to include heading for car direction
  showStartFinish?: boolean;
  showCursor?: boolean;
  trackWidth?: number; // Width of the track for start/finish line
}

export function TrackMarkers({
  startFinish,
  finishLine,
  cursorPosition,
  showStartFinish = true,
  showCursor = true,
  trackWidth = 20,
}: TrackMarkersProps) {
  // Calculate line endpoints perpendicular to heading
  const getLineEndpoints = (
    point: PointWithHeading
  ): { x1: number; y1: number; x2: number; y2: number } | null => {
    if (!point.heading && point.heading !== 0) {
      // No heading available, return null
      return null;
    }

    // Calculate perpendicular direction (90 degrees to heading)
    const perpAngle = point.heading + Math.PI / 2;
    const halfWidth = trackWidth / 2;

    return {
      x1: point.x - Math.cos(perpAngle) * halfWidth,
      y1: point.y - Math.sin(perpAngle) * halfWidth,
      x2: point.x + Math.cos(perpAngle) * halfWidth,
      y2: point.y + Math.sin(perpAngle) * halfWidth,
    };
  };

  const startLine = startFinish ? getLineEndpoints(startFinish) : null;
  const finishLineCoords = finishLine ? getLineEndpoints(finishLine) : null;

  return (
    <g className="track-markers">
      {/* Start line (green) */}
      {showStartFinish && startLine && (
        <line
          x1={startLine.x1}
          y1={startLine.y1}
          x2={startLine.x2}
          y2={startLine.y2}
          stroke="#00ff00"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}

      {/* Finish line (red) */}
      {showStartFinish && finishLineCoords && (
        <line
          x1={finishLineCoords.x1}
          y1={finishLineCoords.y1}
          x2={finishLineCoords.x2}
          y2={finishLineCoords.y2}
          stroke="#ff0000"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}

      {/* Cursor position marker - Circle */}
      {showCursor && cursorPosition && (
        <g className="cursor-marker" style={{ cursor: 'grab' }}>
          {/* Main circle marker */}
          <circle
            cx={cursorPosition.x}
            cy={cursorPosition.y}
            r={8}
            fill="#ff9800"
          />
        </g>
      )}
    </g>
  );
}

export default TrackMarkers;
