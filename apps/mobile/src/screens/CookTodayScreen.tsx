import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DISCLAIMER_TEXT, RecipeView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { LoadingState } from '../components/LoadingState';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { Tag } from '../components/Tag';
import { FadeInView } from '../components/motion/FadeInView';
import { getCuisineImage } from '../constants/cuisineImages';
import { guestPrompts } from '../lib/guestPrompts';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { MainTabScreenProps } from '../navigation/types';

type Props = MainTabScreenProps<'Cook'> & { onRequestLogin: () => void };

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  // Shown once per guest session under the results list (frequency control,
  // guest-mode brief §13) — reworded from the old always-on guest card.
  const [showResultsBenefit, setShowResultsBenefit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  // True when the signed-in recipe generator was unavailable and we served
  // the curated pool instead (the same source guests get). Shown as a note
  // above the results so the list doesn't look silently personalised.
  const [curatedFallback, setCuratedFallback] = useState(false);
  // The recipe-detail hero is a representative cuisine photo, not essential —
  // if it can't load (offline, CDN blocked on this network) hide it rather
  // than leaving a grey box.
  const [heroFailed, setHeroFailed] = useState(false);

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
    setCuratedFallback(false);
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
        } else if (!user && e instanceof ApiError && e.status === 403) {
          // The guest token isn't disclaimer-acknowledged (the local flag and
          // the token's own claim drifted apart, or a fresh token was minted
          // mid-flow). Acknowledge and retry with the rotated token directly —
          // don't call ensureSession() again, it would hand back the stale one.
          results = await requestRecipes(await guestSession.acknowledgeDisclaimer());
        } else {
          throw e;
        }
      }
      setRecipes(results);
      setStep('results');
      if (!user) {
        const seen = await guestPrompts.hasSeen('cook_results');
        if (!seen) {
          setShowResultsBenefit(true);
          void guestPrompts.markSeen('cook_results');
        }
      }
    } catch (e) {
      // The signed-in generator failed (AI provider down, or a server-side
      // error). Retry against the curated pool via a guest session — the
      // same deterministic recipes the guest flow serves — so Cook still
      // works on MVP infrastructure, the way Eat Now falls back to curated.
      if (user) {
        try {
          let curated: RecipeView[];
          try {
            curated = await requestRecipes(await guestSession.ensureSession());
          } catch (inner) {
            if (inner instanceof ApiError && inner.status === 403) {
              curated = await requestRecipes(await guestSession.acknowledgeDisclaimer());
            } else {
              throw inner;
            }
          }
          setRecipes(curated);
          setCuratedFallback(true);
          setStep('results');
          return;
        } catch {
          // fall through to the error message below
        }
      }

      if (e instanceof ApiError && e.status === 503) {
        setError("Cook Today isn't ready yet — the recipe generator isn't configured. Check back soon.");
      } else if (e instanceof ApiError && e.message) {
        // Surface the server's actual message (e.g. an auth/disclaimer problem)
        // rather than a blank generic — makes real failures diagnosable.
        setError(e.message);
      } else if (e instanceof Error && /network/i.test(e.message)) {
        setError("Couldn't reach FoodPadi — check your connection and try again.");
      } else {
        setError('Something went wrong finding recipes. Please try again.');
      }
      setStep('input');
    }
  };

  const openRecipe = (recipe: RecipeView) => {
    setSelectedRecipe(recipe);
    setSaved(false);
    setSavedRecipeId(undefined);
    setHeroFailed(false);
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
      const savedRecipe = await api.saveRecipe(selectedRecipe);
      setSaved(true);
      setSavedRecipeId(savedRecipe.id);
    } finally {
      setSaving(false);
    }
  };

  const startCooking = () => {
    if (!selectedRecipe) return;
    navigation.navigate('CookingSession', { recipe: selectedRecipe, savedRecipeId });
  };

  const goToScan = () => (user ? navigation.navigate('Scan') : onRequestLogin());

  if (step === 'disclaimer') {
    return (
      <Screen>
        <ScreenHeader title="Before you start" />
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button
          label="I understand"
          onPress={acknowledgeDisclaimer}
          loading={acknowledging}
          style={styles.actionSpacing}
        />
      </Screen>
    );
  }

  if (step === 'loading') {
    return <LoadingState message="Finding a few things you could cook…" />;
  }

  if (step === 'detail' && selectedRecipe) {
    const image = getCuisineImage(selectedRecipe.cuisine);
    return (
      <Screen scroll>
        <ScreenHeader title={selectedRecipe.title} onBack={() => setStep('results')} backLabel="Results" />

        {!heroFailed ? (
          <Image
            source={{ uri: image.url }}
            accessibilityLabel={image.alt}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
          />
        ) : null}
        <View style={styles.tagRow}>
          <Tag label={`${selectedRecipe.cookTimeMinutes} min`} />
          <Tag label={`${selectedRecipe.servings} servings`} />
          {selectedRecipe.cuisine ? <Tag label={selectedRecipe.cuisine} /> : null}
        </View>

        <Section title="Ingredients">
          <Card>
            {selectedRecipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredientLine}>
                {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
              </Text>
            ))}
          </Card>
        </Section>

        <Section title="Steps">
          {selectedRecipe.steps.map((step_, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step_}</Text>
            </View>
          ))}
        </Section>

        <Text style={styles.safetyNotice}>
          Food information only. FoodPadi does not monitor allergies, allergic reactions or medical
          conditions and does not determine whether food is medically safe for you.
        </Text>

        <Button label="Start Cooking" onPress={startCooking} style={styles.actionSpacing} />
        <Button
          label={saved ? '✓  Saved' : 'Save this recipe'}
          onPress={saveRecipe}
          disabled={saved}
          loading={saving}
          variant="secondary"
          style={styles.secondaryAction}
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
      </Screen>
    );
  }

  if (step === 'results') {
    return (
      <Screen>
        <ScreenHeader title="A few things you could cook" />
        {curatedFallback ? (
          <Text style={styles.fallbackNote}>
            Showing FoodPadi&apos;s curated recipes — personalised suggestions aren&apos;t available
            right now.
          </Text>
        ) : null}
        {recipes.length === 0 ? (
          <Text style={styles.emptyText}>
            No recipes match that combination. Try a longer time limit, or a few different ingredients.
          </Text>
        ) : (
          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
            {recipes.map((recipe, index) => (
              <FadeInView key={index} delay={index * 40}>
                <Card onPress={() => openRecipe(recipe)} style={styles.resultCard}>
                  <Text style={styles.resultTitle}>{recipe.title}</Text>
                  <View style={styles.tagRow}>
                    <Tag label={`${recipe.cookTimeMinutes} min`} />
                    <Tag label={`${recipe.servings} servings`} />
                    {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                  </View>
                </Card>
              </FadeInView>
            ))}
            {showResultsBenefit ? (
              <MemberBenefitCard
                icon="🔖"
                title="Don't lose these"
                body="Create a free account and FoodPadi keeps your recipes so you can cook them again anytime."
                ctaLabel="Create free account"
                onPress={onRequestLogin}
              />
            ) : null}
          </ScrollView>
        )}
        <Button label="Start over" variant="tertiary" onPress={() => setStep('input')} style={styles.startOver} />
      </Screen>
    );
  }

  // step === 'input' — the Cook tab root
  return (
    <Screen scroll>
      <ScreenHeader title="What's in your kitchen?" subtitle="Scan it, tap what you have, or add something else." />

      <Button
        label="📷 Scan my kitchen"
        variant="secondary"
        onPress={goToScan}
        style={styles.scanButton}
      />

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
        label="Cook Something"
        onPress={findRecipes}
        disabled={ingredients.length === 0}
        style={styles.actionSpacing}
      />

      <View style={styles.moreActions}>
        {user ? (
          <>
            <Button
              label="Import a recipe from a link"
              variant="tertiary"
              onPress={() => navigation.navigate('ImportRecipe')}
            />
            <Button
              label="My saved recipes"
              variant="tertiary"
              onPress={() => navigation.navigate('SavedRecipes')}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    sectionHeading: { ...typography.overline, color: c.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.text,
    },
    addButton: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    addButtonText: { color: c.text, fontWeight: '600' },
    errorText: { color: c.danger, marginTop: spacing.lg, fontSize: 14 },
    emptyText: { ...typography.body, color: c.textMuted },
    actionSpacing: { marginTop: spacing.xl },
    secondaryAction: { marginTop: spacing.sm },
    scanButton: { marginBottom: spacing.lg },
    resultsList: { flex: 1 },
    fallbackNote: { ...typography.caption, color: c.textFaint, marginBottom: spacing.md, lineHeight: 18 },
    startOver: { marginTop: spacing.md },
    moreActions: { marginTop: spacing.lg, gap: spacing.xs },
    heroImage: {
      width: '100%',
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: c.surfaceSunken,
      marginBottom: spacing.md,
    },
    resultCard: { marginBottom: spacing.md },
    resultTitle: { ...typography.title, color: c.text, marginBottom: spacing.sm },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    ingredientLine: { ...typography.body, color: c.text, marginBottom: spacing.xs },
    stepRow: { flexDirection: 'row', marginBottom: spacing.lg, gap: spacing.md },
    stepNumber: {
      fontSize: 13,
      fontWeight: '700',
      color: c.primary,
      backgroundColor: c.primarySoft,
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      textAlign: 'center',
      lineHeight: 26,
      overflow: 'hidden',
    },
    stepText: { fontSize: 16, lineHeight: 24, color: c.text, flex: 1 },
    safetyNotice: { ...typography.caption, color: c.textFaint, marginTop: spacing.lg, lineHeight: 18 },
    disclaimerBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    disclaimerText: { fontSize: 14, lineHeight: 21, color: c.text },
  });
}
