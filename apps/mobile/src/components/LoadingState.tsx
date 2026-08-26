import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

export function FullScreenLoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.fullScreen}>
      <LoadingState message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  message: { ...typography.body, color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
});
