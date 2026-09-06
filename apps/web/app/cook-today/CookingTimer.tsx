'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import styles from './cook-today.module.css';

export interface CookingTimerHandle {
  /** Sets the duration to `seconds` (if given) and starts counting down — used by voice commands like "set a timer for 5 minutes". */
  startWithSeconds: (seconds?: number) => void;
  pause: () => void;
}

const PRESETS_SECONDS = [60, 120, 300, 600]; // 1 / 2 / 5 / 10 min

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// A short beep via the Web Audio API oscillator — no external asset/dependency.
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio isn't available in every environment (autoplay policy, no audio
    // device) — the visual "Time's up!" state is enough on its own.
  }
}

/** Web counterpart to apps/mobile/src/components/CookingTimer.tsx. */
export const CookingTimer = forwardRef<CookingTimerHandle, { suggestedSeconds?: number }>(function CookingTimer(
  { suggestedSeconds },
  ref,
) {
  const initial = suggestedSeconds && suggestedSeconds > 0 ? suggestedSeconds : PRESETS_SECONDS[0];
  const [durationSeconds, setDurationSeconds] = useState(initial);
  const [remainingSeconds, setRemainingSeconds] = useState(initial);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearTicker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = (overrideSeconds?: number) => {
    clearTicker();
    setDone(false);
    setRunning(true);
    if (overrideSeconds && overrideSeconds > 0) {
      setDurationSeconds(overrideSeconds);
      setRemainingSeconds(overrideSeconds);
    }
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearTicker();
          setRunning(false);
          setDone(true);
          playBeep();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const pause = () => {
    clearTicker();
    setRunning(false);
  };

  const reset = (nextDuration = durationSeconds) => {
    clearTicker();
    setRunning(false);
    setDone(false);
    setDurationSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
  };

  useImperativeHandle(ref, () => ({
    startWithSeconds: (seconds?: number) => start(seconds),
    pause,
  }));

  return (
    <div className={styles.timerCard}>
      <p className={`${styles.timerTime} ${done ? styles.timerTimeDone : ''}`}>{formatTime(remainingSeconds)}</p>

      {!running && !done && remainingSeconds === durationSeconds ? (
        <div className={styles.timerPresetRow}>
          {PRESETS_SECONDS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`${styles.chip} ${preset === durationSeconds ? styles.chipSelected : ''}`}
              onClick={() => reset(preset)}
            >
              {preset < 60 ? `${preset}s` : `${preset / 60} min`}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.timerControlRow}>
        {done ? (
          <button type="button" className={styles.secondaryButton} onClick={() => reset()}>
            Reset
          </button>
        ) : running ? (
          <button type="button" className={styles.secondaryButton} onClick={pause}>
            Pause
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={() => start()}>
            {remainingSeconds === durationSeconds ? 'Start Timer' : 'Resume'}
          </button>
        )}
      </div>
      {done ? <p className={styles.timerDoneText}>Time&apos;s up!</p> : null}
    </div>
  );
});
