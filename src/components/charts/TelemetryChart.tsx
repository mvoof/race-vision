import { useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
} from 'recharts';
import type { TelemetrySample } from '../../types';
import { useTrackViewStore } from '../../stores/trackViewStore';
import styles from './TelemetryChart.module.scss';

export interface TelemetryChartProps {
  data: TelemetrySample[];
  height?: number | string;
  syncId?: string;
}

export function TelemetryChart({
  data,
  height = 300,
  syncId = 'telemetry',
}: TelemetryChartProps) {
  const cursorDistance = useTrackViewStore((s) => s.cursorDistance);
  const setCursorDistance = useTrackViewStore((s) => s.setCursorDistance);

  // Memoize data to avoid unnecessary re-renders
  const chartData = useMemo(() => data, [data]);

  const handleMouseMove = useCallback(
    (state: any) => {
      if (state && state.activePayload && state.activePayload.length > 0) {
        const distance = state.activePayload[0].payload.lapDistance;
        setCursorDistance(distance);
      }
    },
    [setCursorDistance]
  );

  const handleMouseLeave = useCallback(() => {
    // onCursorChange(null);
  }, []);

  return (
    <div className={styles.chartContainer} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          syncId={syncId}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis
            dataKey="lapDistance"
            type="number"
            domain={['dataMin', 'dataMax']}
            hide
          />
          <YAxis
            yAxisId="speed"
            orientation="left"
            stroke="#ccff00"
            domain={[0, 'auto']}
            label={{
              value: 'Speed (km/h)',
              angle: -90,
              position: 'insideLeft',
              fill: '#ccff00',
              fontSize: 10,
            }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            yAxisId="input"
            orientation="right"
            stroke="#a0a0a0"
            domain={[0, 1]}
            hide
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const sample = payload[0].payload;
                return (
                  <div className={styles.customTooltip}>
                    <div className={styles.tooltipDistance}>
                      {(sample.lapDistance / 1000).toFixed(3)} km
                    </div>
                    {payload.map((item: any) => (
                      <div
                        key={item.name}
                        className={styles.tooltipItem}
                        style={{ color: item.color }}
                      >
                        <span className={styles.label}>{item.name}:</span>
                        <span className={styles.value}>
                          {item.name === 'Speed'
                            ? `${item.value.toFixed(1)} km/h`
                            : `${(item.value * 100).toFixed(0)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />

          <Legend verticalAlign="top" height={36} />

          {cursorDistance !== null && (
            <ReferenceLine
              x={cursorDistance}
              stroke="#ffffff"
              strokeDasharray="3 3"
              yAxisId="speed"
            />
          )}

          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="speed"
            name="Speed"
            stroke="#ccff00"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="input"
            type="monotone"
            dataKey="throttle"
            name="Throttle"
            stroke="#4caf50"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="input"
            type="monotone"
            dataKey="brake"
            name="Brake"
            stroke="#f44336"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />

          <Brush
            dataKey="lapDistance"
            height={30}
            stroke="#333"
            fill="#1e1e1e"
            tickFormatter={() => ''}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
