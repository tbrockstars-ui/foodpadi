import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const PRESETS_SECONDS = [60, 120, 300, 600]; // 1 / 2 / 5 / 10 min

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface Props {
  /** A duration guessed from the step text (regex hint), or the AI's own
   * structured per-step duration (Cook Today only) — pre-selects/auto-starts
   * that duration if present, else the timer waits on the first preset. */
  suggestedSeconds?: number;
  /** Called once, the moment the countdown reaches zero — lets the caller
   * auto-advance to the next step. Web counterpart: CookingTimer.tsx's same
   * prop, apps/web/app/cook-today/CookingTimer.tsx. */
  onComplete?: () => void;
}

/**
 * A per-step countdown for guided cooking. Timestamp-based (an `endAt`
 * wall-clock target, not a decrementing counter) so the remaining time stays
 * accurate even if this 1s ticker gets throttled while the app is
 * backgrounded — the same fix already applied on web (see that file's own
 * comment). `Vibration` is core react-native — no new dependency.
 */
export function CookingTimer({ suggestedSeconds, onComplete }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const initial = suggestedSeconds && suggestedSeconds > 0 ? suggestedSeconds : PRESETS_SECONDS[0];
  const [durationSeconds, setDurationSeconds] = useState(initial);
  const [remainingSeconds, setRemainingSeconds] = useState(initial);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The wall-clock timestamp the countdown should hit zero at — recomputed
  // fresh on every start()/resume so drift never accumulates.
  const endAtRef = useRef<number | null>(null);
  // The exact remaining duration, in ms, as of the last pause (or the full
  // duration if never started) — what a bare start() with no argument
  // resumes from.
  const remainingMsRef = useRef<number>(initial * 1000);

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
    const remainingMs = endAtRef.current - Date.now();
    if (remainingMs <= 0) {
      clearTicker();
      endAtRef.current = null;
      remainingMsRef.current = 0;
      setRunning(false);
      setDone(true);
      setRemainingSeconds(0);
      Vibration.vibrate([0, 300, 150, 300]);
      onComplete?.();
      return;
    }
    remainingMsRef.current = remainingMs;
    setRemainingSeconds(Math.ceil(remainingMs / 1000));
  };

  // No argument resumes from the exact ms left at the last pause (or the
  // full duration, right after a reset) — an explicit seconds value is used
  // by the preset chips, which reset-then-start in one motion.
  const start = (overrideSeconds?: number) => {
    clearTicker();
    const startFromMs = overrideSeconds !== undefined ? overrideSeconds * 1000 : remainingMsRef.current;
    endAtRef.current = Date.now() + startFromMs;
    remainingMsRef.current = startFromMs;
    setDone(false);
    setRunning(true);
    setRemainingSeconds(Math.ceil(startFromMs / 1000));
    intervalRef.current = setInterval(tick, 1000);
  };

  const pause = () => {
    if (endAtRef.current !== null) {
      remainingMsRef.current = Math.max(0, endAtRef.current - Date.now());
    }
    clearTicker();
    endAtRef.current = null;
    setRunning(false);
  };

  const reset = (nextDuration = durationSeconds) => {
    clearTicker();
    endAtRef.current = null;
    remainingMsRef.current = nextDuration * 1000;
    setRunning(false);
    setDone(false);
    setDurationSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
  };

  // Auto-starts the moment a real duration is known (structured AI timing or
  // a text-guess) — mirrors web's CookingTimer, which starts itself for the
  // same reason: the cook's hands are busy, they shouldn't have to tap
  // "Start Timer" for every single step.
  useEffect(() => {
    if (suggestedSeconds && suggestedSeconds > 0) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.card}>
      <Text style={[styles.time, done && styles.timeDone]}>{formatTime(remainingSeconds)}</Text>

      {!running && !done && remainingSeconds === durationSeconds ? (
        <View style={styles.presetRow}>
          {PRESETS_SECONDS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.presetChip, preset === durationSeconds && styles.presetChipSelected]}
              onPress={() => reset(preset)}
              accessibilityRole="button"
            >
              <Text style={[styles.presetText, preset === durationSeconds && styles.presetTextSelected]}>
                {preset < 60 ? `${preset}s` : `${preset / 60} min`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.controlRow}>
        {done ? (
          <TouchableOpacity style={styles.controlButton} onPress={() => reset()} accessibilityRole="button">
            <Text style={styles.controlText}>Reset</Text>
          </TouchableOpacity>
        ) : running ? (
          <TouchableOpacity style={styles.controlButton} onPress={pause} accessibilityRole="button">
            <Text style={styles.controlText}>Pause</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.controlButton, styles.controlButtonPrimary]} onPress={() => start()} accessibilityRole="button">
            <Text style={styles.controlTextPrimary}>
              {remainingSeconds === durationSeconds ? 'Start Timer' : 'Resume'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {done ? <Text style={styles.doneText}>Time's up!</Text> : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    time: { fontSize: 40, fontWeight: '700', color: c.text, marginBottom: spacing.md, fontVariant: ['tabular-nums'] },
    timeDone: { color: c.primary },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.md },
    presetChip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    presetChipSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    presetText: { fontSize: 13, color: c.text },
    presetTextSelected: { color: c.primary, fontWeight: '600' },
    controlRow: { flexDirection: 'row', gap: spacing.sm },
    controlButton: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    controlButtonPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    controlText: { fontSize: 14, fontWeight: '600', color: c.text },
    controlTextPrimary: { fontSize: 14, fontWeight: '600', color: c.primaryText },
    doneText: { ...typography.caption, color: c.primary, marginTop: spacing.sm, fontWeight: '600' },
  });
}
