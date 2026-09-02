import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FoodIdeaView, MealChoice, MealPlanItemView, MealPlanView, PlanScope } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { BackLink } from '../components/BackLink';
import { PlanAheadGuestPreview } from './PlanAheadGuestPreview';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FoodImage } from '../components/FoodImage';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { getCuisineImage } from '../constants/cuisineImages';
import { cancelMealReminder, scheduleMealReminder } from '../lib/mealReminders';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SUGGESTION_DEBOUNCE_MS = 300;

const BUDGET_LABEL: Record<FoodIdeaView['budgetTier'], string> = {
  low: '£',
  medium: '££',
  high: '£££',
};

function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

type Props = NativeStackScreenProps<AppStackParamList, 'PlanAhead'> & { onRequestLogin: () => void };

// Two primary choices — plan just the next day, or the whole week. Anything
// in between lives behind "More options" as a custom day count (1-14).
const SCOPE_OPTIONS: { label: string; value: PlanScope }[] = [
  { label: 'Just tomorrow', value: 'tomorrow' },
  { label: 'This week', value: 'week' },
];

// Lightweight prompt suggestions — same pattern as Decide's PROMPT_CHIPS:
// each just populates the same free-text field the user could type into by
// hand, never required. Web counterpart: apps/web/app/plan/PlanScopeForm.tsx.
const PROMPT_SUGGESTIONS: { label: string; text: string }[] = [
  { label: 'Quick meals', text: 'Quick meals I can make after work' },
  { label: 'Family meals', text: 'Family-friendly meals' },
  { label: 'Healthy', text: 'Healthy meals' },
  { label: 'Budget-friendly', text: 'Cheap and filling meals' },
  { label: 'Nigerian', text: 'Nigerian food' },
  { label: 'Italian', text: 'Italian food' },
  { label: 'Vegetarian', text: 'Vegetarian meals' },
  { label: 'Vegan', text: 'Vegan meals' },
  { label: 'High-protein', text: 'High-protein meals' },
  { label: 'Comfort food', text: 'Comforting meals' },
  { label: 'Use what I have', text: 'Meals using simple, everyday ingredients' },
  { label: 'Something different', text: 'Something different from usual' },
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

export function PlanAheadScreen({ navigation, onRequestLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const [step, setStep] = useState<'scope' | 'loading' | 'plan'>('scope');
  const [scope, setScope] = useState<PlanScope>('week');
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState('3');
  const [budget, setBudget] = useState('');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<MealPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // "Find it nearby" for a Get-it day — MVP-simulated the same way Eat Now's
  // own primary search is: the real /eat-now/search catalogue endpoint
  // (illustrative distance/time/price, honestly labelled as such), not the
  // real-geolocation LocalFoodSearch. Only one item's results show at once.
  const [nearbyOpenId, setNearbyOpenId] = useState<string | null>(null);
  const [nearbyResults, setNearbyResults] = useState<FoodIdeaView[] | null>(null);
  const [nearbySearching, setNearbySearching] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  // Per-day "replace with something specific" — which day's prompt box is
  // open, and the drafted text for each, keyed by item id.
  const [focusOpenId, setFocusOpenId] = useState<string | null>(null);
  const [focusDrafts, setFocusDrafts] = useState<Record<string, string>>({});
  // Typeahead for the currently-open box only — a dish-name picker instead
  // of free-typing a hint and finding out only after submitting whether
  // anything matched. Scoped to one box at a time (only one is ever open),
  // so this doesn't need to be keyed by item id like focusDrafts is.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionsSeqRef = useRef(0);
  // Draft text for each item's time field, keyed by item id — separate from
  // the committed plannedTime so typing doesn't fire a request per keystroke.
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({});
  const [timeError, setTimeError] = useState<string | null>(null);

  const focusDraft = focusOpenId ? (focusDrafts[focusOpenId] ?? '') : '';

  // Debounced fetch of suggestions as the user types in the open box.
  useEffect(() => {
    if (!focusOpenId || !focusDraft.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const seq = (suggestionsSeqRef.current += 1);
      try {
        const results = await api.searchMealIdeas(focusDraft.trim());
        if (seq !== suggestionsSeqRef.current) return; // superseded by a newer keystroke
        setSuggestions(results);
      } catch {
        // Leave whatever suggestions are already showing rather than
        // surfacing an error for a background typeahead.
      }
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOpenId, focusDraft]);

  // A user returning to Plan Ahead should see the plan they already have,
  // not be asked to create a new one every time (docs/USER_JOURNEYS.md's
  // returning-user pattern).
  useEffect(() => {
    (async () => {
      // Guests have no saved plan and can't call this account-only endpoint —
      // they get the AI-free preview branch below instead.
      if (!user) {
        setCheckingExisting(false);
        return;
      }
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

  const effectiveScope: PlanScope = showCustom ? 'custom' : scope;

  const createPlan = async () => {
    setError(null);
    if (effectiveScope === 'custom') {
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
        scope: effectiveScope,
        customDays: effectiveScope === 'custom' ? Number(customDays) : undefined,
        budgetPence,
        prompt: prompt.trim() || undefined,
      });
      setPlan(result);
      setStep('plan');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong creating your plan.');
      setStep('scope');
    }
  };

  // Back to the scope picker to build a fresh plan — the current one stays
  // saved (it's in the plans list) rather than being replaced.
  const startNewPlan = () => {
    setPlan(null);
    setError(null);
    setExpandedId(null);
    setFocusOpenId(null);
    setStep('scope');
  };

  const regenerate = async (itemId: string, focus?: string) => {
    if (!plan) return;
    setBusyItemId(itemId);
    setError(null);
    try {
      const updated = await api.regeneratePlanItem(plan.id, itemId, focus);
      setPlan(updated);
      setFocusOpenId(null);
      // The recipe changed but mealChoice/plannedTime didn't — re-schedule
      // so the reminder's body text reflects the new meal, not the old one.
      const item = updated.items.find((i) => i.id === itemId);
      if (item?.plannedTime) scheduleMealReminder(item);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not replace that day. Please try again.');
    } finally {
      setBusyItemId(null);
    }
  };

  const regenerateWholePlan = async () => {
    if (!plan) return;
    setRegeneratingPlan(true);
    setError(null);
    try {
      const updated = await api.regeneratePlan(plan.id);
      setPlan(updated);
      setExpandedId(null);
      for (const item of updated.items) {
        if (item.plannedTime) scheduleMealReminder(item);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not rebuild the plan. Please try again.');
    } finally {
      setRegeneratingPlan(false);
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
      // Switching away from "Eat out" hides any nearby results open for it.
      if (mealChoice !== 'eat_out' && nearbyOpenId === itemId) {
        setNearbyOpenId(null);
        setNearbyResults(null);
      }
    } finally {
      setBusyItemId(null);
    }
  };

  // MVP-simulated "find it nearby" — reuses Eat Now's existing illustrative
  // catalogue search (real cuisine/price band, illustrative distance/time/
  // price) rather than building a separate system for Plan Ahead.
  const findNearby = async (item: MealPlanItemView) => {
    if (!item.recipe) return;
    if (nearbyOpenId === item.id) {
      setNearbyOpenId(null);
      return;
    }
    setNearbyOpenId(item.id);
    setNearbyResults(null);
    setNearbyError(null);
    setNearbySearching(true);
    try {
      const token = (await tokenStore.getAccessToken()) ?? '';
      const results = await api.searchEatNow({ query: item.recipe.title }, token);
      setNearbyResults(results);
    } catch (e) {
      setNearbyError(e instanceof ApiError ? e.message : 'Something went wrong searching for food.');
    } finally {
      setNearbySearching(false);
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

  const goToShoppingList = async (regenerate = false) => {
    if (!plan) return;
    setCreatingList(true);
    try {
      const list = await api.generateShoppingList(plan.id, regenerate);
      navigation.navigate('ShoppingList', { listId: list.id });
    } finally {
      setCreatingList(false);
    }
  };

  // Guests get an AI-free preview of Plan Ahead (guest-mode brief §8) —
  // curated dinner ideas, nothing saved. All the account-only machinery
  // above (existing-plan lookup, reminders, per-day regenerate) is skipped.
  if (!user) {
    return <PlanAheadGuestPreview navigation={navigation} onRequestLogin={onRequestLogin} />;
  }

  if (checkingExisting) {
    return <LoadingState />;
  }

  if (step === 'loading') {
    return <LoadingState message="Building your plan…" />;
  }

  if (step === 'plan' && plan) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BackLink label="Home" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Your plan</Text>
        <Text style={styles.subtitle}>
          {plan.status === 'accepted' ? 'Accepted — ready for shopping.' : "Review it, then accept when you're happy."}
        </Text>
        {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}

        {plan.items.map((item) => (
          <Card key={item.id} style={styles.mealCard}>
            <View style={styles.mealHeaderRow}>
              {item.recipe ? (
                <Image source={{ uri: getCuisineImage(item.recipe.cuisine).url }} style={styles.mealImage} />
              ) : null}
              <View style={styles.mealHeaderContent}>
                <Text style={styles.mealDate}>{formatDate(item.plannedDate)}</Text>
                {item.recipe ? (
                  <TouchableOpacity
                    onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${expandedId === item.id ? 'Hide' : 'Show'} ingredients for ${item.recipe.title}`}
                  >
                    <Text style={styles.mealTitle}>{item.recipe.title}</Text>
                    <View style={styles.tagRow}>
                      <Tag label={`${item.recipe.cookTimeMinutes} min`} />
                      <Tag label={`${item.recipe.servings} servings`} />
                      {item.recipe.cuisine ? <Tag label={item.recipe.cuisine} /> : null}
                    </View>
                    <Text style={styles.detailsLink}>
                      {expandedId === item.id ? 'Hide ingredients ▲' : 'Show ingredients ▼'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.mealTitle}>Nothing planned for this day</Text>
                )}
              </View>
            </View>

            {item.recipe && expandedId === item.id ? (
              <View style={styles.recipeDetail}>
                <Text style={styles.sectionHeading}>Ingredients</Text>
                {item.recipe.ingredients.map((ingredient, i) => (
                  <Text key={i} style={styles.ingredientLine}>
                    {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                    {ingredient.unit ? `${ingredient.unit} ` : ''}
                    {ingredient.name}
                  </Text>
                ))}

                <Text style={styles.sectionHeading}>Steps</Text>
                {item.recipe.steps.map((s, i) => (
                  <View key={i} style={styles.stepRow}>
                    <Text style={styles.stepNumber}>{i + 1}</Text>
                    <Text style={styles.stepText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

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

            {item.mealChoice === 'eat_out' ? (
              <TouchableOpacity onPress={() => findNearby(item)} accessibilityRole="button">
                <Text style={styles.itemActionText}>{nearbyOpenId === item.id ? 'Hide' : 'Find it nearby'}</Text>
              </TouchableOpacity>
            ) : null}

            {nearbyOpenId === item.id ? (
              <View style={styles.nearbyBlock}>
                {nearbySearching ? <Text style={styles.mealDate}>Looking nearby…</Text> : null}
                {nearbyError ? <Text style={styles.errorText}>{nearbyError}</Text> : null}
                {nearbyResults ? (
                  <>
                    <Text style={styles.disclaimerNote}>
                      Example suggestions from a small curated list — cuisine and price band are real;
                      distance, delivery time and exact price are illustrative estimates, not live data from
                      any restaurant.
                    </Text>
                    {nearbyResults.length === 0 ? (
                      <Text style={styles.emptyText}>
                        Nothing matched nearby. Try replacing this day with something else.
                      </Text>
                    ) : (
                      nearbyResults.map((idea) => (
                        <Card key={idea.id} style={styles.resultCard}>
                          <FoodImage
                            image={idea.image}
                            alt={idea.title}
                            style={styles.resultImage}
                            badge={idea.tags.includes('vegan') ? 'Vegan' : undefined}
                          />
                          <Text style={styles.resultTitle}>{idea.title}</Text>
                          <Text style={styles.resultBody}>{idea.description}</Text>
                          <Text style={styles.estimateText}>
                            ~{idea.distanceMiles} mi · {idea.deliveryMinutesMin}–{idea.deliveryMinutesMax} min ·{' '}
                            {formatPence(idea.pricePenceMin)}–{formatPence(idea.pricePenceMax)}
                          </Text>
                          <View style={styles.tagRow}>
                            <Tag label={idea.cuisine} />
                            <Tag label={BUDGET_LABEL[idea.budgetTier]} />
                          </View>
                        </Card>
                      ))
                    )}
                  </>
                ) : null}
              </View>
            ) : null}

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

            <View style={styles.itemActions}>
              <TouchableOpacity onPress={() => regenerate(item.id)} disabled={busyItemId === item.id}>
                <Text style={styles.itemActionText}>{busyItemId === item.id ? 'Working…' : 'Replace this day'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSuggestions([]);
                  setFocusOpenId(focusOpenId === item.id ? null : item.id);
                }}
                disabled={busyItemId === item.id}
              >
                <Text style={styles.itemActionText}>
                  {focusOpenId === item.id ? 'Cancel' : 'Replace with something specific'}
                </Text>
              </TouchableOpacity>
              {/* Removing a day (vs. swapping it) only makes sense before the
                  plan is accepted — an accepted plan's shopping list is built
                  from the full day list, so cutting a day at that point is a
                  bigger, more disruptive edit than the brief asked for here. */}
              {plan.status === 'draft' ? (
                <TouchableOpacity onPress={() => remove(item.id)} disabled={busyItemId === item.id}>
                  <Text style={styles.itemActionTextDanger}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {focusOpenId === item.id ? (
              <View style={styles.focusContainer}>
                <View style={styles.focusRow}>
                  <TextInput
                    style={styles.focusInput}
                    placeholder="e.g. pizza, a quick pasta"
                    placeholderTextColor={colors.textFaint}
                    value={focusDrafts[item.id] ?? ''}
                    onChangeText={(text) => setFocusDrafts((current) => ({ ...current, [item.id]: text }))}
                    onSubmitEditing={() => regenerate(item.id, (focusDrafts[item.id] ?? '').trim() || undefined)}
                    autoComplete="off"
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => regenerate(item.id, (focusDrafts[item.id] ?? '').trim() || undefined)}
                    disabled={busyItemId === item.id || !(focusDrafts[item.id] ?? '').trim()}
                  >
                    <Text style={styles.itemActionText}>{busyItemId === item.id ? 'Working…' : 'Replace'}</Text>
                  </TouchableOpacity>
                </View>
                {suggestions.length > 0 ? (
                  <View style={styles.suggestionsList}>
                    {suggestions.map((title) => (
                      <TouchableOpacity
                        key={title}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFocusDrafts((current) => ({ ...current, [item.id]: title }));
                          setSuggestions([]);
                          regenerate(item.id, title);
                        }}
                      >
                        <Text style={styles.suggestionItemText}>{title}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}

        <View style={styles.planActionsRow}>
          <TouchableOpacity onPress={regenerateWholePlan} disabled={regeneratingPlan}>
            <Text style={styles.itemActionText}>
              {regeneratingPlan ? 'Rebuilding…' : plan.scope === 'tomorrow' ? 'Replace this day-plan' : 'Replace whole plan'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startNewPlan}>
            <Text style={styles.itemActionText}>Start a new plan</Text>
          </TouchableOpacity>
        </View>

        {plan.status === 'draft' ? (
          <Button label="Accept plan" onPress={accept} loading={accepting} style={styles.actionSpacing} />
        ) : plan.shoppingListId ? (
          <>
            <Button
              label="View shopping list"
              onPress={() => goToShoppingList(false)}
              loading={creatingList}
              style={styles.actionSpacing}
            />
            <Button
              label="Rebuild list from plan"
              variant="secondary"
              onPress={() => goToShoppingList(true)}
              loading={creatingList}
              style={styles.actionSpacing}
            />
          </>
        ) : (
          <Button
            label="Create shopping list"
            onPress={() => goToShoppingList(false)}
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
      <BackLink label="Home" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>How far ahead?</Text>
      <Text style={styles.subtitle}>Pick what fits — you don't have to plan a whole week.</Text>

      <View style={styles.chipWrap}>
        {SCOPE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={!showCustom && scope === option.value}
            onPress={() => {
              setShowCustom(false);
              setScope(option.value);
            }}
          />
        ))}
        <Chip label="More options" selected={showCustom} onPress={() => setShowCustom((v) => !v)} />
      </View>

      {showCustom ? (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Number of days (1-14)</Text>
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
        <Text style={styles.fieldLabel}>What would you like to eat? (optional)</Text>
        <TextInput
          style={styles.promptTextarea}
          placeholder="Tell FoodPadi what you're in the mood for… e.g. &quot;Nigerian food this week&quot;"
          placeholderTextColor={colors.textFaint}
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={2}
          maxLength={200}
        />
        <View style={styles.chipWrap}>
          {PROMPT_SUGGESTIONS.map((s) => (
            <Chip key={s.label} label={s.label} selected={prompt === s.text} onPress={() => setPrompt(s.text)} />
          ))}
        </View>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Weekly budget (optional)</Text>
        <View style={styles.budgetField}>
          {budget ? <Text style={styles.budgetAffixPrefix}>£</Text> : null}
          <TextInput
            style={[styles.smallInput, budget ? styles.budgetInputHasPrefix : null]}
            keyboardType="decimal-pad"
            placeholder="£70"
            placeholderTextColor={colors.textFaint}
            value={budget}
            onChangeText={setBudget}
            autoComplete="off"
          />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button label="Create my plan" onPress={createPlan} style={styles.actionSpacing} />
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
  title: { ...typography.display, color: c.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  fieldRow: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm },
  smallInput: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: c.text,
    maxWidth: 160,
  },
  // Budget field — a £ prefix that appears once a value is typed, same
  // pattern as DecideFlow's budget input.
  budgetField: { position: 'relative', maxWidth: 160 },
  budgetInputHasPrefix: { paddingLeft: 22 },
  budgetAffixPrefix: {
    position: 'absolute',
    top: '50%',
    left: spacing.lg,
    marginTop: -8,
    fontSize: 15,
    color: c.textMuted,
    zIndex: 1,
  },
  promptTextarea: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: c.text,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  errorText: { color: c.danger, marginBottom: spacing.md, fontSize: 14 },
  actionSpacing: { marginTop: spacing.lg },
  // "Find it nearby" results (Get-it days) — mirrors EatNowScreen's result
  // card styling exactly, since this reuses the same /eat-now/search data.
  nearbyBlock: { marginTop: spacing.sm, marginBottom: spacing.xs },
  disclaimerNote: { ...typography.caption, color: c.textFaint, marginBottom: spacing.md, lineHeight: 18 },
  emptyText: { ...typography.body, color: c.textMuted, marginBottom: spacing.md },
  resultCard: { marginBottom: spacing.md },
  resultImage: { marginBottom: spacing.md },
  resultTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  resultBody: { ...typography.body, color: c.textMuted, marginBottom: spacing.sm },
  estimateText: { ...typography.caption, color: c.textMuted, marginBottom: spacing.sm },
  mealCard: { marginBottom: spacing.md },
  mealHeaderRow: { flexDirection: 'row', gap: spacing.md },
  mealImage: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: c.surfaceSunken },
  mealHeaderContent: { flex: 1 },
  mealDate: { ...typography.label, color: c.textMuted, marginBottom: spacing.xs },
  mealTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  detailsLink: { color: c.primary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  recipeDetail: { marginBottom: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  sectionHeading: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  ingredientLine: { ...typography.body, color: c.text, marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepNumber: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primarySoft,
    color: c.primary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: { ...typography.body, color: c.text, flex: 1, lineHeight: 20 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  focusContainer: { marginTop: spacing.sm },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  focusInput: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.text,
    flex: 1,
  },
  // Typeahead results — a plain stacked list below the input rather than an
  // absolutely-positioned overlay, so it never needs to worry about z-index
  // or covering other content; it just pushes the rest of the card down.
  suggestionsList: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  suggestionItemText: { fontSize: 14, color: c.text },
  planActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  itemActionText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  itemActionTextDanger: { color: c.danger, fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  timeInput: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.text,
    maxWidth: 160,
    flex: 1,
  },
  reminderNote: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs },
  });
}
