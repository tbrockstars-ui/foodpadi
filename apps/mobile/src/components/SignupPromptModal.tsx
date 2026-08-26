import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';

interface Props {
  visible: boolean;
  message: string;
  onCreateAccount: () => void;
  onDismiss: () => void;
}

/**
 * The contextual signup prompt from docs/FOODPADI_ONBOARDING_SPEC.md —
 * appears only at the moment a guest tries to do something that needs an
 * account (save, plan, remind). Dismissing it must never discard whatever
 * the guest was looking at — this component only overlays, it never
 * unmounts the screen behind it.
 */
export function SignupPromptModal({ visible, message, onCreateAccount, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Save this for next time?</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onCreateAccount} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Create a free account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 21, 15, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    ...shadow.raised,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  message: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: spacing.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
});
