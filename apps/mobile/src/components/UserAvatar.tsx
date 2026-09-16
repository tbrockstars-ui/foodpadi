import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseAvatarId } from '@foodpadi/shared';
import { radius, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

function initialsFrom(displayName: string | null | undefined, email: string | undefined): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

/**
 * Circular avatar badge — shows the user's chosen birth-month icon (user
 * instruction 2026-09-11) when set, falling back to initials otherwise. No
 * gradient library in this app, so unlike the web version this is a flat
 * fill using the icon's `colorFrom`, not a two-stop gradient.
 */
export function UserAvatar({
  displayName,
  email,
  avatarId,
  size = 40,
}: {
  displayName?: string | null;
  email?: string;
  avatarId?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const avatar = parseAvatarId(avatarId);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatar ? avatar.colorFrom : colors.primarySoft,
          borderWidth: avatar ? 0 : 1,
        },
      ]}
    >
      <Text style={avatar ? { fontSize: size * 0.5 } : [styles.initials, { color: colors.primaryDark, fontSize: size * 0.35 }]}>
        {avatar ? avatar.emoji : initialsFrom(displayName, email)}
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: c.border,
      overflow: 'hidden',
      borderRadius: radius.pill,
    },
    initials: { fontWeight: '700' },
  });
}
