import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MealChoice, MealPlanItemView, MealPlanView, PlanScope } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { cancelMealReminder, scheduleMealReminder } from '../lib/mealReminders';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type Props = NativeStackScreenProps<AppStackParamList, 'PlanAhead'>;

const SCOPE_OPTIONS: { label: string; value: PlanScope }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Next 3 days', value: '3day' },
  { label: 'This week', value: 'week' },
  { label: 'Custom', value: 'custom' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The reminder fires 30 minutes before plannedTime — shown so "30 min before X" isn't left for the user to do the maths on. */
function formatReminderTime(plannedTime: string): string {
  const [hours, minutes] = plannedTime.split(':').map(Number);
  const total = (hours * 60 + minutes - 30 + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function PlanAheadScreen({ navigation }: Props) {
  const [step, setStep] = useState<'scope' | 'loading' | 'plan'>('scope');
  const [scope, setScope] = useState<PlanScope>('3day');
  const [customDays, setCustomDays] = useState('3');
  const [budget, setBudget] = useState('');
  const [plan, setPlan] = useState<MealPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  // Draft text for each item's time field, keyed by item id — separate from
  // the committed plannedTime so typing doesn't fire a request per keystroke.
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({});
  const [timeError, setTimeError] = useState<string | null>(null);

  // A user returning to Plan Ahead should see the plan they already have,
  // not be asked to create a new one every time (docs/USER_JOURNEYS.md's
  // returning-user pattern).
  useEffect(() => {
    (async () => {
      const current = await api.getCurrentPlan();
      if (current) {
        setPlan(current);
        setStep('plan');
        // Re-arm reminders on load — local notifications are scheduled by
        // *this device*, so a reinstalled app or a plan edited from
        // elsewhere needs them re-synced rather than assumed still pending.
        for (const item of current.items) {
          if (item.plannedTime) scheduleMealReminder(item);
        }
      }
      setCheckingExisting(false);
    })();
  }, []);

  const createPlan = async () => {
    setError(null);
    if (scope === 'custom') {
      const parsed = Number(customDays);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 14) {
        setError('Enter a number of days between 1 and 14.');
        return;
      }
    }
    setStep('loading');
    try {
      const budgetPence = budget.trim() ? Math.round(parseFloat(budget) * 100) : undefined;
      const result = await api.generatePlan({
        scope,
        customDays: scope === 'custom' ? Number(customDays) : undefined,
        budgetPence,
      });
      setPlan(result);
      setStep('plan');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong creating your plan.');
      setStep('scope');
    }
  };

  const regenerate = async (itemId: string) => {
    if (!plan) return;
    setBusyItemId(itemId);
    try {
      const updated = await api.regeneratePlanItem(plan.id, itemId);
      setPlan(updated);
      // The recipe changed but mealChoice/plannedTime didn't — re-schedule
      // so the reminder's body text reflects the new meal, not the old one.
      const item = updated.items.find((i) => i.id === itemId);
      if (item?.plannedTime) scheduleMealReminder(item);
    } finally {
      setBusyItemId(null);
    }
  };

  const remove = async (itemId: string) => {
    if (!plan) return;
    setBusyItemId(itemId);
    try {
      setPlan(await api.removePlanItem(plan.id, itemId));
      await cancelMealReminder(itemId);
    } finally {
      setBusyItemId(null);
    }
  };

  const accept = async () => {
    if (!plan) return;
    setAccepting(true);
    try {
      setPlan(await api.acceptPlan(plan.id));
    } finally {
      setAccepting(false);
    }
  };

  const setMealChoice = async (itemId: string, mealChoice: MealChoice) => {
    if (!plan) return;
    setBusyItemId(itemId);
    try {
      const updated = await api.updatePlanItem(plan.id, itemId, { mealChoice });
      setPlan(updated);
      const item = updated.items.find((i) => i.id === itemId);
      if (item?.plannedTime) scheduleMealReminder(item); // wording differs by choice — resync
    } finally {
      setBusyItemId(null);
    }
  };

  const applyPlannedTime = async (item: MealPlanItemView) => {
    const draft = (timeDrafts[item.id] ?? '').trim();
    setTimeError(null);
    if (draft && !TIME_PATTERN.test(draft)) {
      setTimeError('Enter a time as HH:mm, e.g. 18:30.');
      return;
    }
    if (!plan) return;
    setBusyItemId(item.id);
    try {
      const updated = await api.updatePlanItem(plan.id, item.id, { plannedTime: draft || null });
      setPlan(updated);
      const updatedItem = updated.items.find((i) => i.id === item.id);
      if (updatedItem) {
        if (updatedItem.plannedTime) {
          const scheduled = await scheduleMealReminder(updatedItem);
          if (!scheduled) setTimeError("That time's already passed today — no reminder was set.");
        } else {
          await cancelMealReminder(item.id);
        }
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const goToShoppingList = async () => {
    if (!plan) return;
    setCreatingList(true);
    try {
      const list = await api.generateShoppingList(plan.id);
      navigation.navigate('ShoppingList', { listId: list.id });
    } finally {
      setCreatingList(false);
    }
  };

  if (checkingExisting) {
    return <LoadingState />;
  }

  if (step === 'loading') {
    return <LoadingState message="Building your plan…" />;
  }

  if (step === 'plan' && plan) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your plan</Text>
        <Text style={styles.subtitle}>
          {plan.status === 'accepted' ? 'Accepted — ready for shopping.' : "Review it, then accept when you're happy."}
        </Text>
        {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}

        {plan.items.map((item) => (
          <Card key={item.id} style={styles.mealCard}>
            <Text style={styles.mealDate}>{formatDate(item.plannedDate)}</Text>
            {item.recipe ? (
              <>
                <Text style={styles.mealTitle}>{item.recipe.title}</Text>
                <View style={styles.tagRow}>
                  <Tag label={`${item.recipe.cookTimeMinutes} min`} />
                  <Tag label={`${item.recipe.servings} servings`} />
                  {item.recipe.cuisine ? <Tag label={item.recipe.cuisine} /> : null}
                </View>
              </>
            ) : (
              <Text style={styles.mealTitle}>Nothing planned for this day</Text>
            )}

            <View style={styles.chipWrap}>
              <Chip
                label="Cook it"
                role="radio"
                selected={item.mealChoice === 'cook'}
                onPress={() => setMealChoice(item.id, 'cook')}
              />
              <Chip
                label="Eat out"
                role="radio"
                selected={item.mealChoice === 'eat_out'}
                onPress={() => setMealChoice(item.id, 'eat_out')}
              />
            </View>

            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                placeholder="HH:mm, e.g. 18:30"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                value={timeDrafts[item.id] ?? item.plannedTime ?? ''}
                onChangeText={(text) => setTimeDrafts((current) => ({ ...current, [item.id]: text }))}
                onSubmitEditing={() => applyPlannedTime(item)}
                autoComplete="off"
              />
              <TouchableOpacity onPress={() => applyPlannedTime(item)} disabled={busyItemId === item.id}>
                <Text style={styles.itemActionText}>{item.plannedTime ? 'Update' : 'Set time'}</Text>
              </TouchableOpacity>
            </View>
            {item.plannedTime ? (
              <Text style={styles.reminderNote}>
                🔔 We&apos;ll remind you at {formatReminderTime(item.plannedTime)} — 30 min before it&apos;s time to{' '}
                {item.mealChoice === 'eat_out' ? 'order' : 'start cooking'}.
              </Text>
            ) : null}

            {plan.status === 'draft' ? (
              <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => regenerate(item.id)} disabled={busyItemId === item.id}>
                  <Text style={styles.itemActionText}>{busyItemId === item.id ? 'Working…' : 'Regenerate'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(item.id)} disabled={busyItemId === item.id}>
                  <Text style={styles.itemActionTextDanger}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Card>
        ))}

        {plan.status === 'draft' ? (
          <Button label="Accept plan" onPress={accept} loading={accepting} style={styles.actionSpacing} />
        ) : (
          <Button
            label="Create shopping list"
            onPress={goToShoppingList}
            loading={creatingList}
            style={styles.actionSpacing}
          />
        )}
      </ScrollView>
    );
  }

  // step === 'scope'
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Home</Text>
      </TouchableOpacity>
      <Text style={styles.title}>How far ahead?</Text>
      <Text style={styles.subtitle}>Pick what fits — you don't have to plan a whole week.</Text>

      <View style={styles.chipWrap}>
        {SCOPE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={scope === option.value}
            onPress={() => setScope(option.value)}
          />
        ))}
      </View>

      {scope === 'custom' ? (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Days (1-14)</Text>
          <TextInput
            style={styles.smallInput}
            keyboardType="number-pad"
            value={customDays}
            onChangeText={setCustomDays}
            autoComplete="off"
          />
        </View>
      ) : null}

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Weekly budget (optional)</Text>
        <TextInput
          style={styles.smallInput}
          keyboardType="decimal-pad"
          placeholder="£70"
          placeholderTextColor={colors.textFaint}
          value={budget}
          onChangeText={setBudget}
          autoComplete="off"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button label="Create my plan" onPress={createPlan} style={styles.actionSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  fieldRow: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  smallInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    maxWidth: 160,
  },
  errorText: { color: colors.danger, marginBottom: spacing.md, fontSize: 14 },
  actionSpacing: { marginTop: spacing.lg },
  mealCard: { marginBottom: spacing.md },
  mealDate: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  mealTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  itemActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  itemActionText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  itemActionTextDanger: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    maxWidth: 160,
    flex: 1,
  },
  reminderNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
