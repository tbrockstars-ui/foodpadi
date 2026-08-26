import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GoalsEditor } from '../components/goals/GoalsEditor';
import { colors } from '../theme/colors';

/**
 * Onboarding entry point for Food & Lifestyle Goals — goal selection is
 * optional (docs/FOODPADI_ONBOARDING_SPEC.md), so this screen doesn't
 * complete onboarding itself; Preferences (the next, also-skippable step)
 * does that once the short sequence is done. All the selection/primary-goal
 * logic lives in GoalsEditor, shared with Profile > Edit Goals.
 */
export function GoalScreen({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.container}>
      <GoalsEditor onDone={onNext} onSkip={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
});
