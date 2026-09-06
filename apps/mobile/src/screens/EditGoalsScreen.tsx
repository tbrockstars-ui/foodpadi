import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FoodGoal } from '@foodpadi/shared';
import { api } from '../api/client';
import { GoalsEditor } from '../components/goals/GoalsEditor';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'EditGoals'>;

/**
 * Profile > Food Preferences > Food & Lifestyle Goals (spec §19) — lets a
 * user change goals later without repeating onboarding. Thin wrapper around
 * the same GoalsEditor onboarding uses, seeded from the user's current goals.
 */
export function EditGoalsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [initialGoals, setInitialGoals] = useState<FoodGoal[]>([]);
  const [initialPrimary, setInitialPrimary] = useState<FoodGoal | null>(null);
  const [initialNote, setInitialNote] = useState('');

  useEffect(() => {
    api.getGoals().then(({ goals }) => {
      setInitialGoals(goals.map((g) => g.goalType));
      setInitialPrimary(goals.find((g) => g.isPrimary)?.goalType ?? null);
      setInitialNote(goals.find((g) => g.goalType === 'personal')?.note ?? '');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <LoadingState message="Loading your goals…" />;
  }

  return (
    <Screen>
      <ScreenHeader title="Your goals" onBack={() => navigation.goBack()} backLabel="Profile" />
      <GoalsEditor
        initialGoals={initialGoals}
        initialPrimary={initialPrimary}
        initialNote={initialNote}
        continueLabel="Save changes"
        onDone={() => navigation.goBack()}
        onCancel={() => navigation.goBack()}
      />
    </Screen>
  );
}
