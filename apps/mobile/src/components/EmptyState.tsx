import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', padding: spacing.xl },
    title: { ...typography.title, color: c.text, textAlign: 'center', marginBottom: spacing.sm },
    body: { ...typography.body, color: c.textMuted, textAlign: 'center', marginBottom: spacing.lg },
    action: { minWidth: 180 },
  });
}
