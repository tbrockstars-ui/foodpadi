import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT, RecipeView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { LoadingState } from '../components/LoadingState';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { Tag } from '../components/Tag';
import { colors, radius, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'CookToday'> & { onRequestLogin: () => void };

const QUICK_INGREDIENTS = [
  'Chicken',
  'Rice',
  'Onions',
  'Peppers',
  'Eggs',
  'Pasta',
  'Tomatoes',
  'Spinach',
  'Potatoes',
  'Garlic',
];

const TIME_OPTIONS = [
  { label: 'No limit', value: undefined },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
] as const;

type Step = 'disclaimer' | 'input' | 'loading' | 'results' | 'detail';

export function CookTodayScreen({ navigation, route, onRequestLogin }: Props) {
  const { user } = useAuth();
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;

  const [step, setStep] = useState<Step>(needsGuestDisclaimer ? 'disclaimer' : 'input');
  // Deep-linked from Scan's "Cook with what's in your pantry" — pre-fills
  // what was just confirmed rather than making the user re-type it.
  const [ingredients, setIngredients] = useState<string[]>(route.params?.initialIngredients ?? []);
  const [customIngredient, setCustomIngredient] = useState('');
  const [timeConstraint, setTimeConstraint] = useState<number | undefined>(undefined);
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const toggleIngredient = (name: string) => {
    setIngredients((current) =>
      current.includes(name) ? current.filter((i) => i !== name) : [...current, name],
    );
  };

  const addCustomIngredient = () => {
    const trimmed = customIngredient.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((current) => [...current, trimmed]);
    }
    setCustomIngredient('');
  };

  const acknowledgeDisclaimer = async () => {
    setAcknowledging(true);
    try {
      await guestSession.acknowledgeDisclaimer();
      setStep('input');
    } finally {
      setAcknowledging(false);
    }
  };

  const requestRecipes = (token: string) =>
    api.generateCookTodayRecipes({ ingredients, timeConstraintMinutes: timeConstraint, servings: 2 }, token);

  const findRecipes = async () => {
    setError(null);
    setStep('loading');
    try {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      let results;
      try {
        results = await requestRecipes(token ?? '');
      } catch (e) {
        // A cached guest token the server no longer accepts (24h TTL lapsed,
        // or the API restarted with a rotated secret) surfaces as a 401 —
        // there's no way to detect that in advance, so recover by minting a
        // fresh guest session and retrying once before giving up.
        if (!user && e instanceof ApiError && e.status === 401) {
          results = await requestRecipes(await guestSession.recoverSession());
        } else {
          throw e;
        }
      }
      setRecipes(results);
      setStep('results');
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Cook Today isn't ready yet — the recipe generator isn't configured. Check back soon.");
      } else {
        setError('Something went wrong finding recipes. Please try again.');
      }
      setStep('input');
    }
  };

  const openRecipe = (recipe: RecipeView) => {
    setSelectedRecipe(recipe);
    setSaved(false);
    setStep('detail');
  };

  const saveRecipe = async () => {
    if (!selectedRecipe) return;
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }
    setSaving(true);
    try {
      await api.saveRecipe(selectedRecipe);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'disclaimer') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Before you start</Text>
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button label="I understand" onPress={acknowledgeDisclaimer} loading={acknowledging} style={styles.actionSpacing} />
      </View>
    );
  }

  if (step === 'loading') {
    return <LoadingState message="Finding a few things you could cook…" />;
  }

  if (step === 'detail' && selectedRecipe) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BackLink label="Back to results" onPress={() => setStep('results')} />

        <Text style={styles.title}>{selectedRecipe.title}</Text>
        <View style={styles.tagRow}>
          <Tag label={`${selectedRecipe.cookTimeMinutes} min`} />
          <Tag label={`${selectedRecipe.servings} servings`} />
          {selectedRecipe.cuisine ? <Tag label={selectedRecipe.cuisine} /> : null}
        </View>

        <Text style={styles.sectionHeading}>Ingredients</Text>
        <Card style={styles.section}>
          {selectedRecipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredientLine}>
              {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
            </Text>
          ))}
        </Card>

        <Text style={styles.sectionHeading}>Steps</Text>
        <Card style={styles.section}>
          {selectedRecipe.steps.map((step_, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step_}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.safetyNotice}>
          Food information only. FoodPadi does not monitor allergies, allergic reactions or medical
          conditions and does not determine whether food is medically safe for you.
        </Text>

        <Button
          label={saved ? 'Saved' : 'Save this recipe'}
          onPress={saveRecipe}
          disabled={saved}
          loading={saving}
          style={styles.actionSpacing}
        />

        <SignupPromptModal
          visible={showSignupPrompt}
          message="Create a free account and FoodPadi will remember this recipe for next time."
          onCreateAccount={() => {
            setShowSignupPrompt(false);
            onRequestLogin();
          }}
          onDismiss={() => setShowSignupPrompt(false)}
        />
      </ScrollView>
    );
  }

  if (step === 'results') {
    return (
      <View style={styles.container}>
        <BackLink label="Home" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>A few things you could cook</Text>
        {recipes.length === 0 ? (
          <Text style={styles.emptyText}>
            No recipes match that combination. Try a longer time limit, or a few different ingredients.
          </Text>
        ) : (
          <ScrollView>
            {recipes.map((recipe, index) => (
              <Card key={index} onPress={() => openRecipe(recipe)} style={styles.resultCard}>
                <Text style={styles.resultTitle}>{recipe.title}</Text>
                <View style={styles.tagRow}>
                  <Tag label={`${recipe.cookTimeMinutes} min`} />
                  <Tag label={`${recipe.servings} servings`} />
                  {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
        <Button label="Start over" variant="secondary" onPress={() => setStep('input')} style={styles.actionSpacing} />
      </View>
    );
  }

  // step === 'input'
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Home" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>What have you got?</Text>
      <Text style={styles.subtitle}>Tap what you have, or add something else.</Text>

      <View style={styles.chipWrap}>
        {QUICK_INGREDIENTS.map((name) => (
          <Chip key={name} label={name} selected={ingredients.includes(name)} onPress={() => toggleIngredient(name)} />
        ))}
        {ingredients
          .filter((i) => !(QUICK_INGREDIENTS as readonly string[]).includes(i))
          .map((name) => (
            <Chip key={name} label={`${name} ✕`} selected onPress={() => toggleIngredient(name)} />
          ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add something else"
          placeholderTextColor={colors.textFaint}
          value={customIngredient}
          onChangeText={setCustomIngredient}
          onSubmitEditing={addCustomIngredient}
          returnKeyType="done"
          autoComplete="off"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomIngredient}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>How much time have you got?</Text>
      <View style={styles.chipWrap}>
        {TIME_OPTIONS.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={timeConstraint === option.value}
            onPress={() => setTimeConstraint(option.value)}
          />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label="Find recipes"
        onPress={findRecipes}
        disabled={ingredients.length === 0}
        style={styles.actionSpacing}
      />

      {user ? (
        <>
          <TouchableOpacity onPress={() => navigation.navigate('ImportRecipe')} style={styles.importLink}>
            <Text style={styles.importLinkText}>Or import a recipe from a link →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SavedRecipes')} style={styles.importLink}>
            <Text style={styles.importLinkText}>View my saved recipes →</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  sectionHeading: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  section: { marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: colors.text, fontWeight: '600' },
  errorText: { color: colors.danger, marginTop: spacing.lg, fontSize: 14 },
  emptyText: { ...typography.body, color: colors.textMuted },
  actionSpacing: { marginTop: spacing.xl },
  importLink: { marginTop: spacing.lg, alignItems: 'center' },
  importLinkText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  resultCard: { marginBottom: spacing.md },
  resultTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  ingredientLine: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md },
  stepNumber: {
    ...typography.label,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: { ...typography.body, color: colors.text, flex: 1 },
  safetyNotice: { ...typography.caption, color: colors.textFaint, marginTop: spacing.lg, lineHeight: 18 },
  disclaimerBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  disclaimerText: { fontSize: 14, lineHeight: 21, color: colors.text },
});
