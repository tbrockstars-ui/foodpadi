import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MealPlanView, PlanScope } from '@foodpadi/shared';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FadeInView } from '../components/motion/FadeInView';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'SavedPlans'>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function scopeLabel(scope: PlanScope, dayCount: number): string {
  switch (scope) {
    case 'tomorrow':
      return 'Next day';
    case 'today':
      return 'Today';
    case 'week':
      return 'This week';
    case '3day':
      return '3 days';
    default:
      return `${dayCount} day${dayCount === 1 ? '' : 's'}`;
  }
}

/** Every meal plan the user has generated (auto-saved), like Saved recipes. */
export function SavedPlansScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [plans, setPlans] = useState<MealPlanView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setPlans(await api.listPlans());
      setLoadFailed(false);
    } catch {
      // Don't strand the screen on the spinner if the request fails.
      setLoadFailed(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const removePlan = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deletePlan(id);
      setPlans((current) => current?.filter((p) => p.id !== id) ?? null);
      if (expandedId === id) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (plans === null) {
    if (loadFailed) {
      return (
        <Screen>
          <ScreenHeader title="Saved plans" onBack={() => navigation.goBack()} />
          <EmptyState
            title="Couldn't load your saved plans"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              setLoadFailed(false);
              void load();
            }}
          />
        </Screen>
      );
    }
    return <LoadingState message="Loading your saved plans…" />;
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Saved plans" onBack={() => navigation.goBack()} />

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>
          No plans yet — create one in Plan Ahead and it&apos;ll be saved here automatically.
        </Text>
      ) : (
        plans.map((plan, index) => {
          const expanded = expandedId === plan.id;
          return (
            <FadeInView key={plan.id} delay={index * 40}>
            <Card style={styles.planCard}>
              <TouchableOpacity onPress={() => setExpandedId(expanded ? null : plan.id)}>
                <Text style={styles.planTitle}>
                  {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
                </Text>
                <View style={styles.tagRow}>
                  <Tag label={scopeLabel(plan.scope, plan.items.length)} />
                  <Tag label={`${plan.items.length} meal${plan.items.length === 1 ? '' : 's'}`} />
                  {plan.status === 'accepted' ? <Tag label="Accepted" /> : null}
                </View>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.detail}>
                  {plan.items.map((item) => (
                    <View key={item.id} style={styles.dayRow}>
                      <Text style={styles.dayDate}>{formatDate(item.plannedDate)}</Text>
                      <Text style={styles.dayMeal}>{item.recipe ? item.recipe.title : 'Nothing planned'}</Text>
                    </View>
                  ))}

                  {plan.shoppingListId ? (
                    <Button
                      label="View shopping list"
                      variant="secondary"
                      onPress={() => navigation.navigate('ShoppingList', { listId: plan.shoppingListId as string })}
                      style={{ marginTop: spacing.md }}
                    />
                  ) : null}

                  <Button
                    label={deletingId === plan.id ? 'Removing…' : 'Delete plan'}
                    variant="danger"
                    onPress={() => removePlan(plan.id)}
                    loading={deletingId === plan.id}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              ) : null}
            </Card>
            </FadeInView>
          );
        })
      )}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  emptyText: { ...typography.body, color: c.textMuted },
  planCard: { marginBottom: spacing.md },
  planTitle: { ...typography.title, color: c.text, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detail: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
  dayRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  dayDate: { ...typography.caption, color: c.textMuted, width: 56 },
  dayMeal: { ...typography.body, color: c.text, flex: 1 },
  });
}
