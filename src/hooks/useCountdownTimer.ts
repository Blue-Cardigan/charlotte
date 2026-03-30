import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseCountdownTimerOptions {
  durationMinutes: number;
  isRunning: boolean;
  milestonesInSeconds?: number[];
  onMilestone?: (remainingSeconds: number) => void;
}

function normalizeDurationSeconds(durationMinutes: number): number {
  return Math.max(1, Math.round(durationMinutes * 60));
}

export function useCountdownTimer({
  durationMinutes,
  isRunning,
  milestonesInSeconds = [120, 60],
  onMilestone,
}: UseCountdownTimerOptions) {
  const durationSeconds = useMemo(
    () => normalizeDurationSeconds(durationMinutes),
    [durationMinutes],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const triggeredMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setRemainingSeconds(durationSeconds);
    triggeredMilestonesRef.current = new Set();
  }, [durationSeconds]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const tick = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 0) {
          return 0;
        }
        const next = previous - 1;

        milestonesInSeconds.forEach((milestone) => {
          if (
            next <= milestone &&
            !triggeredMilestonesRef.current.has(milestone)
          ) {
            triggeredMilestonesRef.current.add(milestone);
            onMilestone?.(next);
          }
        });

        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(tick);
    };
  }, [isRunning, milestonesInSeconds, onMilestone]);

  const resetTimer = useCallback((nextDurationMinutes?: number) => {
    const seconds = normalizeDurationSeconds(
      nextDurationMinutes ?? durationMinutes,
    );
    setRemainingSeconds(seconds);
    triggeredMilestonesRef.current = new Set();
  }, [durationMinutes]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remainingSeconds]);

  return {
    remainingSeconds,
    formattedTime,
    resetTimer,
    hasElapsed: remainingSeconds <= 0,
  };
}
