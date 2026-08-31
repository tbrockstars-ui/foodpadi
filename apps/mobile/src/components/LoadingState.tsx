import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

export function LoadingState({ message }: { message?: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

export function FullScreenLoadingState({ message }: { message?: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.fullScreen}>
      <LoadingState message={message} />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    message: { ...typography.body, color: c.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  });
}
