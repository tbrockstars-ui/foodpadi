import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  BIRTH_MONTHS,
  avatarOptionsForMonth,
  parseAvatarId,
  type AvatarOption,
  type UserSummary,
} from '@foodpadi/shared';
import { api } from '../api/client';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing, radius, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackScreenProps } from '../navigation/types';

type Props = AppStackScreenProps<'EditAvatar'>;

/**
 * Birth-month avatar picker (user instruction 2026-09-11) — "beautiful icons
 * that represent their birth month". Picking a month is its own save
 * (defaults future visits here); tapping a shade swatch saves the avatar
 * itself immediately — trying things on, not filling in a form.
 */
export function EditAvatarScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.me().then((me) => {
        setProfile(me);
        setAvatarId(me.avatarId);
        setMonth(me.birthMonth ?? parseAvatarId(me.avatarId)?.month ?? new Date().getMonth() + 1);
      });
    }, []),
  );

  const onMonthChange = async (newMonth: number) => {
    setMonth(newMonth);
    setBusy(true);
    try {
      await api.updateProfile({ birthMonth: newMonth });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (option: AvatarOption) => {
    setBusy(true);
    try {
      const updated = await api.updateProfile({
        avatarId: option.id,
        ...(profile?.birthMonth == null ? { birthMonth: month } : {}),
      });
      setAvatarId(updated.avatarId);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const updated = await api.updateProfile({ avatarId: null });
      setAvatarId(updated.avatarId);
    } finally {
      setBusy(false);
    }
  };

  const active = parseAvatarId(avatarId);
  const shadeOptions = avatarOptionsForMonth(month);

  return (
    <Screen scroll>
      <ScreenHeader title="Choose your avatar" onBack={() => navigation.goBack()} />

      <View style={styles.previewRow}>
        <View
          style={[
            styles.previewCircle,
            { backgroundColor: active ? active.colorFrom : colors.surfaceSunken },
          ]}
        >
          <Text style={styles.previewEmoji}>{active ? active.emoji : '🙂'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewLabel}>
            {active ? `${active.monthLabel} · ${active.shadeLabel}` : 'No avatar chosen yet'}
          </Text>
          {active ? (
            <TouchableOpacity onPress={clear} disabled={busy}>
              <Text style={styles.removeText}>Remove — show my initials instead</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hint}>Pick your birth month, then a shade you like.</Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Birth month</Text>
      <View style={styles.monthGrid}>
        {BIRTH_MONTHS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.monthChip, month === m.value ? styles.monthChipActive : null]}
            onPress={() => onMonthChange(m.value)}
            disabled={busy}
          >
            <Text style={[styles.monthChipText, month === m.value ? styles.monthChipTextActive : null]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Pick a shade</Text>
      <View style={styles.swatchRow}>
        {shadeOptions.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[
              styles.swatch,
              { backgroundColor: o.colorFrom },
              avatarId === o.id ? styles.swatchActive : null,
            ]}
            onPress={() => pick(o)}
            disabled={busy}
            accessibilityLabel={`${o.monthLabel} ${o.shadeLabel}`}
          >
            <Text style={styles.swatchEmoji}>{o.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
    previewCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    previewEmoji: { fontSize: 34 },
    previewLabel: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
    hint: { fontSize: 13, color: c.textMuted },
    removeText: { fontSize: 13, color: c.danger, textDecorationLine: 'underline' },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: c.textMuted, marginBottom: spacing.sm },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xl },
    monthChip: {
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    monthChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    monthChipText: { fontSize: 13, color: c.text },
    monthChipTextActive: { color: '#0a0a0a', fontWeight: '700' },
    swatchRow: { flexDirection: 'row', gap: spacing.md },
    swatch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchActive: { borderWidth: 3, borderColor: c.primary },
    swatchEmoji: { fontSize: 26 },
  });
}
