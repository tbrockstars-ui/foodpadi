import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT, RecipeView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
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

export function CookTodayScreen({ navigation, onRequestLogin }: Props) {
  const { user } = useAuth();
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;

  const [step, setStep] = useState<Step>(needsGuestDisclaimer ? 'disclaimer' : 'input');
  const [ingredients, setIngredients] = useState<string[]>([]);
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

  const findRecipes = async () => {
    setError(null);
    setStep('loading');
    try {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      const results = await api.generateCookTodayRecipes(
        { ingredients, timeConstraintMinutes: timeConstraint, servings: 2 },
        token ?? '',
      );
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
        <TouchableOpacity style={styles.primaryButton} onPress={acknowledgeDisclaimer} disabled={acknowledging}>
          <Text style={styles.primaryButtonText}>I understand</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Finding a few things you could cook…</Text>
      </View>
    );
  }

  if (step === 'detail' && selectedRecipe) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <TouchableOpacity onPress={() => setStep('results')} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Back to results</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{selectedRecipe.title}</Text>
        <View style={styles.tagRow}>
          <Tag label={`${selectedRecipe.cookTimeMinutes} min`} />
          <Tag label={`${selectedRecipe.servings} servings`} />
          {selectedRecipe.cuisine ? <Tag label={selectedRecipe.cuisine} /> : null}
        </View>

        <Text style={styles.sectionHeading}>Ingredients</Text>
        <View style={styles.card}>
          {selectedRecipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredientLine}>
              {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionHeading}>Steps</Text>
        <View style={styles.card}>
          {selectedRecipe.steps.map((step_, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step_}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.safetyNotice}>
          Food information only. FoodPadi does not monitor allergies, allergic reactions or medical
          conditions and does not determine whether food is medically safe for you.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, saved && styles.primaryButtonSaved]}
          onPress={saveRecipe}
          disabled={saving || saved}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>{saved ? 'Saved' : 'Save this recipe'}</Text>
          )}
        </TouchableOpacity>

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>A few things you could cook</Text>
        <ScrollView>
          {recipes.map((recipe, index) => (
            <TouchableOpacity key={index} style={styles.resultCard} onPress={() => openRecipe(recipe)}>
              <Text style={styles.resultTitle}>{recipe.title}</Text>
              <View style={styles.tagRow}>
                <Tag label={`${recipe.cookTimeMinutes} min`} />
                <Tag label={`${recipe.servings} servings`} />
                {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('input')}>
          <Text style={styles.secondaryButtonText}>Start over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // step === 'input'
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Home</Text>
      </TouchableOpacity>
      <Text style={styles.title}>What have you got?</Text>
      <Text style={styles.subtitle}>Tap what you have, or add something else.</Text>

      <View style={styles.chipWrap}>
        {QUICK_INGREDIENTS.map((name) => {
          const isSelected = ingredients.includes(name);
          return (
            <TouchableOpacity
              key={name}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggleIngredient(name)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
        {ingredients
          .filter((i) => !(QUICK_INGREDIENTS as readonly string[]).includes(i))
          .map((name) => (
            <TouchableOpacity key={name} style={[styles.chip, styles.chipSelected]} onPress={() => toggleIngredient(name)}>
              <Text style={styles.chipTextSelected}>{name} ✕</Text>
            </TouchableOpacity>
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
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomIngredient}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>How much time have you got?</Text>
      <View style={styles.chipWrap}>
        {TIME_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[styles.chip, timeConstraint === option.value && styles.chipSelected]}
            onPress={() => setTimeConstraint(option.value)}
          >
            <Text style={[styles.chipText, timeConstraint === option.value && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, ingredients.length === 0 && styles.primaryButtonDisabled]}
        onPress={findRecipes}
        disabled={ingredients.length === 0}
      >
        <Text style={styles.primaryButtonText}>Find recipes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  sectionHeading: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryButtonSaved: { backgroundColor: colors.primaryDark },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
  loadingText: { ...typography.body, color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  resultTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  tag: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
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
