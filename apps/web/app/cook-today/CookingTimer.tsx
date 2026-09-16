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

interface Props {
  suggestedSeconds?: number;
  /** Called exactly once when the countdown reaches zero — lets a parent
      (CookingSession) auto-advance to the next step. Not called on manual
      Reset, or if the timer is paused/never started. */
  onComplete?: () => void;
  /** When resuming a persisted Cooking Journey mid-step: seconds left on the
      server's copy of this step's timer. When set, the timer seeds to this
      value and waits for the user to press Resume (brief §20 — never shows a
      falsely-running timer after an interruption). */
  initialRemainingSeconds?: number;
  /** Fired on start / pause / resume / done so a parent can mirror the timer
      to the server (CookingJourney timer fields). Best-effort — a dropped
      call never affects the local countdown. */
  onTimerEvent?: (
    kind: 'start' | 'pause' | 'resume' | 'complete',
    payload: { remainingSeconds: number; durationSeconds: number },
  ) => void;
}

/**
 * Web counterpart to apps/mobile/src/components/CookingTimer.tsx.
 *
 * Timestamp-based, not a plain per-second decrement: `endAtRef` holds the
 * absolute ms-since-epoch the countdown should hit zero, and every tick
 * recomputes `remaining = endAt - Date.now()` instead of subtracting 1 from
 * the previous value. A `setInterval` still drives the once-a-second UI
 * refresh, but the *displayed* number is always derived from real elapsed
 * wall-clock time — so a backgrounded/throttled tab (where the browser can
 * delay ticks to well under 1/sec) still shows the correct remaining time
 * the moment it's foregrounded again, instead of having lost however many
 * ticks it missed.
 */
export const CookingTimer = forwardRef<CookingTimerHandle, Props>(function CookingTimer(
  { suggestedSeconds, onComplete, initialRemainingSeconds, onTimerEvent },
  ref,
) {
  const initial = suggestedSeconds && suggestedSeconds > 0 ? suggestedSeconds : PRESETS_SECONDS[0];
  const resuming = typeof initialRemainingSeconds === 'number' && initialRemainingSeconds > 0 && initialRemainingSeconds < initial;
  const [durationSeconds, setDurationSeconds] = useState(initial);
  const [remainingSeconds, setRemainingSeconds] = useState(resuming ? (initialRemainingSeconds as number) : initial);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The absolute timestamp the countdown reaches zero — the single source of
  // truth while running. Null while paused/idle/done (remainingSeconds state
  // is the source of truth then).
  const endAtRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onTimerEventRef = useRef(onTimerEvent);
  onTimerEventRef.current = onTimerEvent;

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

  const tick = () => {
    if (endAtRef.current === null) return;
    const msLeft = endAtRef.current - Date.now();
    if (msLeft <= 0) {
      clearTicker();
      endAtRef.current = null;
      setRemainingSeconds(0);
      setRunning(false);
      setDone(true);
      playBeep();
      onTimerEventRef.current?.('complete', { remainingSeconds: 0, durationSeconds });
      onCompleteRef.current?.();
      return;
    }
    setRemainingSeconds(Math.ceil(msLeft / 1000));
  };

  const start = (overrideSeconds?: number) => {
    clearTicker();
    setDone(false);
    setRunning(true);
    const startFrom =
      overrideSeconds && overrideSeconds > 0
        ? overrideSeconds
        : remainingSeconds > 0
          ? remainingSeconds
          : durationSeconds;
    if (overrideSeconds && overrideSeconds > 0) {
      setDurationSeconds(overrideSeconds);
    }
    setRemainingSeconds(startFrom);
    endAtRef.current = Date.now() + startFrom * 1000;
    intervalRef.current = setInterval(tick, 1000);
    const fresh = startFrom === (overrideSeconds && overrideSeconds > 0 ? overrideSeconds : durationSeconds);
    onTimerEventRef.current?.(fresh ? 'start' : 'resume', {
      remainingSeconds: startFrom,
      durationSeconds: overrideSeconds && overrideSeconds > 0 ? overrideSeconds : durationSeconds,
    });
  };

  // Auto-starts the moment a real suggested duration is known — the guided
  // cooking flow (CookingSession, key={stepIndex} so this remounts fresh per
  // step) never wants the user to press "Start Timer" by hand. Runs once on
  // mount only: `start` reads `suggestedSeconds` via the closure over the
  // initial render, which is exactly the value this instance was created
  // with (a new stepIndex means a brand new CookingTimer instance, not a
  // prop update on this one).
  useEffect(() => {
    // Skip auto-start when resuming a persisted journey mid-step — the user
    // presses Resume so we never show a falsely-running timer (brief §20).
    if (!resuming && suggestedSeconds && suggestedSeconds > 0) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = () => {
    // Recompute one last time so the paused value reflects real elapsed
    // time exactly, not whatever the last 1s-cadence tick happened to show.
    let left = remainingSeconds;
    if (endAtRef.current !== null) {
      const msLeft = Math.max(0, endAtRef.current - Date.now());
      left = Math.ceil(msLeft / 1000);
      setRemainingSeconds(left);
    }
    clearTicker();
    endAtRef.current = null;
    setRunning(false);
    onTimerEventRef.current?.('pause', { remainingSeconds: left, durationSeconds });
  };

  const reset = (nextDuration = durationSeconds) => {
    clearTicker();
    endAtRef.current = null;
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
