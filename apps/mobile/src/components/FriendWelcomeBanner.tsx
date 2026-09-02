import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/**
 * "Feed a Friend", friend side (strategy §3): a one-time warm welcome for
 * someone who joined through an invite link. Recognition, not a paid perk —
 * see docs/REFERRAL_PLAN.md §3. Self-fetches; shows once, then acks server-side.
 * Web twin: apps/web/components/FriendWelcomeBanner.tsx.
 */
export function FriendWelcomeBanner() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getReferralReceived()
      .then((r) => {
        if (active && r.unseenWelcome) setShow(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    void api.ackReferralWelcome();
  };

  if (!show) return null;

  return (
    <View style={styles.banner}>
      <TouchableOpacity style={styles.close} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.text}>
        🎁 You joined FoodPadi through a friend — welcome! Deciding, cooking and planning are all
        here whenever you don&apos;t know what to eat.
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    banner: {
      marginBottom: spacing.lg,
      padding: spacing.md,
      paddingRight: spacing.xl,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.md,
    },
    close: { position: 'absolute', top: 4, right: 6, padding: 6 },
    closeText: { color: c.textMuted, fontSize: 14 },
    text: { ...typography.caption, color: c.primaryDark, lineHeight: 19 },
  });
}
