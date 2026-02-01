import { useState, useEffect, useRef, useCallback } from 'react';

/** During playback NO React state updates happen — the cursor canvas and
 *  timeline display read from refs directly at 60fps. React state is only
 *  flushed on pause/stop/seek/end, keeping the main thread free of re-renders. */

interface UsePlaybackOptions {
  duration: number;
  initialTime?: number;
  onTick?: (time: number) => void;
  onEnd?: () => void;
}

export function usePlayback({
  duration,
  initialTime = 0,
  onTick,
  onEnd,
}: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const requestRef = useRef(0);
  const previousTimeRef = useRef(0);

  // High-frequency time ref — updated every rAF frame (60 fps).
  // Consumer code (cursor rAF loops) should read from this ref
  // instead of the `currentTime` state to avoid React overhead.
  const currentTimeRef = useRef(initialTime);

  // Refs to avoid stale closures inside rAF callback
  const speedRef = useRef(playbackSpeed);
  const durationRef = useRef(duration);
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onEnd);

  speedRef.current = playbackSpeed;
  durationRef.current = duration;
  onTickRef.current = onTick;
  onEndRef.current = onEnd;

  // Stable animate callback — ZERO dependencies, all values read from refs.
  const animate = useCallback((time: number) => {
    const delta = (time - previousTimeRef.current) / 1000;
    previousTimeRef.current = time;

    // Update ref at full 60fps speed
    let next = currentTimeRef.current + delta * speedRef.current;

    if (next >= durationRef.current) {
      next = durationRef.current;
      currentTimeRef.current = next;
      // Flush final time to state immediately
      setCurrentTime(next);
      queueMicrotask(() => {
        setIsPlaying(false);
        onEndRef.current?.();
      });
      return; // Don't schedule next frame
    }
    if (next < 0) next = 0;

    currentTimeRef.current = next;

    // No React state update here — cursor + timeline read from refs at 60fps.
    // React state is flushed only on pause/stop/seek/end.

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  // Start/stop the rAF loop + periodic React state flush for chart/widgets
  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);

      // Flush currentTime to React state every ~200ms so chart cursor, delta,
      // lap time display, and widgets update without overwhelming React.
      const flushInterval = setInterval(() => {
        setCurrentTime(currentTimeRef.current);
      }, 200);

      return () => {
        cancelAnimationFrame(requestRef.current);
        clearInterval(flushInterval);
      };
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, animate]);

  // Keep ref in sync when state is set externally (seek, stop)
  const play = useCallback(() => {
    if (currentTimeRef.current >= durationRef.current) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    // Flush final position to state so UI catches up
    setCurrentTime(currentTimeRef.current);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    onTickRef.current?.(0);
  }, []);

  const seek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, durationRef.current));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    onTickRef.current?.(clamped);
  }, []);

  return {
    isPlaying,
    currentTime,
    currentTimeRef,
    playbackSpeed,
    play,
    pause,
    stop,
    seek,
    setPlaybackSpeed,
  };
}
