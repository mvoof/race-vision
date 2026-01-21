interface Point {
  x: number;
  y: number;
}

interface TrackMarkersProps {
  startFinish?: Point;
  cursorPosition?: Point;
  showStartFinish?: boolean;
  showCursor?: boolean;
}

export function TrackMarkers({
  startFinish,
  cursorPosition,
  showStartFinish = true,
  showCursor = true,
}: TrackMarkersProps) {
  return (
    <g className="track-markers">
      {/* Start/Finish marker */}
      {showStartFinish && startFinish && (
        <g className="start-finish-marker">
          <circle
            cx={startFinish.x}
            cy={startFinish.y}
            r={8}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={2}
          />
          {/* Checkered flag pattern */}
          <circle cx={startFinish.x} cy={startFinish.y} r={4} fill="#000000" />
        </g>
      )}

      {/* Cursor position marker */}
      {showCursor && cursorPosition && (
        <g className="cursor-marker">
          <circle
            cx={cursorPosition.x}
            cy={cursorPosition.y}
            r={8}
            fill="#ff9800"
            stroke="#ffffff"
            strokeWidth={2}
          />
          {/* Pulsing effect via CSS animation */}
          <circle
            cx={cursorPosition.x}
            cy={cursorPosition.y}
            r={12}
            fill="none"
            stroke="#ff9800"
            strokeWidth={2}
            opacity={0.5}
            className="cursor-pulse"
          />
        </g>
      )}
    </g>
  );
}

export default TrackMarkers;
