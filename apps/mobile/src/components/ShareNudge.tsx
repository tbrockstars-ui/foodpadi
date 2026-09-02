import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ReferralNudgeContext } from '@foodpadi/shared';
import { api } from '../api/client';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const COPY: Record<ReferralNudgeContext, { text: string; message: string }> = {
  decision: {
    text: 'Found something good? Your friend might be wondering what to eat too.',
    message: "🍽️ FoodPadi just helped me decide what to eat. Try it:",
  },
  cook: {
    text: 'Cooked something good? Send FoodPadi to someone who never knows what to eat.',
    message: '👨‍🍳 FoodPadi sorted out what I’m cooking. Try it:',
  },
  plan: {
    text: 'Planning your week? Help a friend plan theirs.',
    message: '📅 I’m planning my meals with FoodPadi. Try it:',
  },
};

/**
 * A compact "share FoodPadi" prompt shown at a moment food naturally becomes
 * social — after a decision, after cooking, after planning (strategy §4).
 * Referral is a key acquisition channel, so it lives in the flow, not just
 * the Invite screen. Logged-in users only; shows once per app session per
 * context, and is dismissible. Web twin: apps/web/components/ShareNudge.tsx.
 */
const seenThisSession = new Set<string>();

export function ShareNudge({ context }: { context: ReferralNudgeContext }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [link, setLink] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(seenThisSession.has(context));

  useEffect(() => {
    if (dismissed) return;
    let active = true;
    api
      .getReferralLink()
      .then((r) => {
        if (active) setLink(r.link);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [dismissed]);

  const dismiss = () => {
    seenThisSession.add(context);
    setDismissed(true);
  };

  if (dismissed || !link) return null;

  const { text, message } = COPY[context];

  const share = async () => {
    try {
      const result = await Share.share({ message: `${message} ${link}` });
      if (result.action === Share.sharedAction) {
        void api.trackReferralShare('native');
        dismiss();
      }
    } catch {
      // Sheet dismissed — leave the nudge in place.
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.close} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity style={styles.button} onPress={share} accessibilityRole="button">
        <Text style={styles.buttonText}>Share FoodPadi</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginTop: spacing.md,
      padding: spacing.lg,
      paddingRight: spacing.xl,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
    },
    close: { position: 'absolute', top: 6, right: 8, padding: 6 },
    closeText: { color: c.textFaint, fontSize: 14 },
    text: { ...typography.body, color: c.text, marginBottom: spacing.md },
    button: {
      alignSelf: 'flex-start',
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    buttonText: { color: c.primaryText, fontWeight: '600', fontSize: 14 },
  });
}
