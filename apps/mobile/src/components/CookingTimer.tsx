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
  /** A duration guessed from the step text (regex hint) — pre-selects that preset if it matches, else the first. */
  suggestedSeconds?: number;
}

/**
 * A per-step countdown for guided cooking. No backend/AI timing data exists
 * (RecipeView.steps is plain text — see Phase 1 plan), so the duration is
 * always user-picked, just pre-filled from a regex guess when the step text
 * names one. `Vibration` is core react-native — no new dependency.
 */
export function CookingTimer({ suggestedSeconds }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

  const start = () => {
    clearTicker();
    setDone(false);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearTicker();
          setRunning(false);
          setDone(true);
          Vibration.vibrate([0, 300, 150, 300]);
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
          <TouchableOpacity style={[styles.controlButton, styles.controlButtonPrimary]} onPress={start} accessibilityRole="button">
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
