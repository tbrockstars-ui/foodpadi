import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  DISCLAIMER_TEXT,
  RecipeView,
  describeRecipeMatch,
  isVeganFood,
  type ClientEventMetadata,
  type ClientEventType,
} from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FridgeCheck } from '../components/FridgeCheck';
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

// Mood chips on the blank entry screen — mobile counterpart to
// apps/web/app/cook-today/CookTodayForm.tsx's MOOD_CHIPS. Same "canned free
// text" pattern the web Decide flow already uses: picking one just runs the
// text through the exact same generateRecipes() call a hand-typed sentence
// would. No new filter dimension, no new endpoint.
const MOOD_CHIPS: { label: string; text: string }[] = [
  { label: '⚡ Quick (15 min)', text: 'Something quick, ready in about 15 minutes' },
  { label: '🍲 Comfort Food', text: 'Comforting, home-style food' },
  { label: '🥗 Healthy & Fresh', text: 'Something healthy and fresh' },
  { label: '👨‍👩‍👧 Family Dinner', text: 'A family dinner everyone will like' },
  { label: '💰 Budget Friendly', text: 'Something cheap and budget-friendly' },
  { label: '🎲 Try Something New', text: 'Something different from what I usually cook' },
];

// "Good ideas for you" / "FoodPadi's Pick" / "Quick cook" card shape — mobile
// counterpart to apps/web/lib/homeIdeas.ts's IdeaCardData, minus the fields
// (priceEstimate) this screen doesn't surface. Built from the same real
// GET /home/ideas the web app calls.
interface IdeaCardData {
  title: string;
  timeMinutes: number;
  difficulty: string;
  matchPercent: number | null;
  badge: string | null;
  isVegan: boolean;
  image: { url: string; alt: string };
  recipe?: RecipeView;
}

interface RecentlyCookedCardData {
  id: string;
  title: string;
  daysAgo: number;
  image: { url: string; alt: string };
  isVegan: boolean;
}

interface PantrySummaryItem {
  id: string;
  name: string;
  quantityLabel: string | null;
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

// Lifts an optional servings count out of free text ("...for 4 people") —
// same regex as apps/web/app/cook-today/CookTodayForm.tsx's parseServingsHint.
// No match just means "use the default", never a parsing error.
function parseServingsHint(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*(?:people|persons|servings?)/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function CookTodayScreen({ navigation, route, onRequestLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;

  // Fire-and-forget client-only analytics — resolves whichever token this
  // session actually has (signed-in or guest) and never throws; a dropped
  // analytics call must never affect the real Cook Today experience. Web
  // counterpart: apps/web/lib/trackClientEvent.ts.
  const trackEvent = async (eventType: ClientEventType, metadata?: ClientEventMetadata) => {
    try {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      if (token) await api.trackEvent({ eventType, metadata }, token);
    } catch {
      // Best-effort only.
    }
  };

  const [step, setStep] = useState<Step>(needsGuestDisclaimer ? 'disclaimer' : 'input');
  // Deep-linked from Scan's "Cook with what's in your pantry" — pre-fills
  // what was just confirmed rather than making the user re-type it.
  const [ingredients, setIngredients] = useState<string[]>(route.params?.initialIngredients ?? []);
  const [customIngredient, setCustomIngredient] = useState('');
  // Primary "What do you want to cook?" entry — the whole sentence becomes
  // the single ingredients-array entry, same precedent as DecideService's
  // free-text-to-Cook-Today path on the server. Deep-linked from a Decide
  // result's "Cook It" button (DecideFlow.tsx) with the selected meal's exact
  // title — same initial-state-only precedent as `ingredients` above; the
  // customer can still edit it before submitting.
  const [freeText, setFreeText] = useState(route.params?.initialPrompt ?? '');
  // The ingredient-chip picker (scan/chips/time-filter/"Cook Something")
  // stays collapsed by default — free text is the primary entry point, this
  // is the secondary "or browse by ingredient instead" path, revealed on
  // request rather than competing with the input box for attention.
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [timeConstraint, setTimeConstraint] = useState<number | undefined>(undefined);
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  // "None of these? Try another set" — the request that produced the current
  // results (so a retry can resubmit the identical ingredients/servings) and
  // every title shown so far for it (so the retry excludes them). Both reset
  // whenever a genuinely new request starts (findRecipes/findRecipesFromText).
  const [lastRequest, setLastRequest] = useState<{ ingredientsList: string[]; servingsOverride?: number } | null>(
    null,
  );
  const [shownTitles, setShownTitles] = useState<string[]>([]);
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
  // Start Cooking's gate for a signed-in user (guests never render
  // FridgeCheck, so it's irrelevant for them — see the disabled expression
  // on the button below): false until every "need to buy" item is ticked
  // off inside FridgeCheck, which reports readiness up via this setter.
  const [ingredientsReady, setIngredientsReady] = useState(false);
  // "This takes longer than your target" banner — dismissed (not gone
  // forever) once the user explicitly says "Cook this anyway"; resets to
  // showing again for the next recipe opened, so a dismissal on one recipe
  // never silently suppresses the warning on a different, unrelated one.
  const [timeWarningDismissed, setTimeWarningDismissed] = useState(false);

  // "Good ideas for you" / "FoodPadi's Pick" / "Quick cook" / "Recently
  // cooked" / "Use these first" — real data from the same endpoints web's
  // Cook Today page calls (see apps/web/lib/homeIdeas.ts), loaded once on
  // mount rather than gating the whole screen on it: a failed load just
  // leaves these sections empty, the free-text entry above still works.
  const [ideaCards, setIdeaCards] = useState<IdeaCardData[]>([]);
  const [recentlyCooked, setRecentlyCooked] = useState<RecentlyCookedCardData[]>([]);
  const [pantrySummary, setPantrySummary] = useState<PantrySummaryItem[]>([]);
  // Cycles through the rest of the same already-fetched ideas list on "Try
  // another" — never a second fetch.
  const [pickIndex, setPickIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      if (!token) return;
      try {
        const res = await api.getHomeIdeas(token);
        if (cancelled) return;
        setIdeaCards(
          (res?.ideas ?? []).map((i) => ({
            title: i.title,
            timeMinutes: i.timeMinutes,
            difficulty: i.difficulty,
            matchPercent: i.matchPercent,
            badge: i.bestMatch ? 'Best match' : null,
            isVegan: isVeganFood({ title: i.title }),
            image: getCuisineImage(i.cuisine),
            recipe: user ? i.recipe : undefined,
          })),
        );
      } catch {
        // Leave the section empty rather than block/blank the screen.
      }
      if (!user) return; // recently-cooked/pantry are members-only
      try {
        const res = await api.getRecentlyCooked(token);
        if (cancelled) return;
        setRecentlyCooked(
          (res?.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            daysAgo: daysAgo(item.lastCookedAt),
            image: getCuisineImage(item.cuisine),
            isVegan: isVeganFood({ title: item.title }),
          })),
        );
      } catch {
        // Empty stays empty — never fabricated "you cooked this" history.
      }
      try {
        const res = await api.listPantryItems();
        if (cancelled) return;
        setPantrySummary(
          (res?.items ?? []).slice(0, 3).map((item) => ({
            id: item.id,
            name: item.name,
            quantityLabel: [item.quantity, item.unit].filter(Boolean).join(' ') || null,
          })),
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  // Generic generator — both the ingredient-chip picker and the free-text
  // box below funnel through this one function, so entitlement gating,
  // guest-token recovery, and curated fallback stay exactly as they are
  // today regardless of entry point.
  //
  // `excludeTitles` powers "None of these? Try another set" — a fresh
  // request (findRecipes/findRecipesFromText) always passes [] and that
  // resets shownTitles below; tryAnotherSet resubmits the *same* request
  // with every title shown so far excluded, so repeated taps keep surfacing
  // new options rather than looping the same few.
  const generateRecipes = async (ingredientsList: string[], servingsOverride?: number, excludeTitles: string[] = []) => {
    const requestRecipes = (token: string) =>
      api.generateCookTodayRecipes(
        {
          ingredients: ingredientsList,
          timeConstraintMinutes: timeConstraint,
          servings: servingsOverride ?? 2,
          excludeTitles: excludeTitles.length > 0 ? excludeTitles : undefined,
        },
        token,
      );

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
      setLastRequest({ ingredientsList, servingsOverride });
      setShownTitles((prev) =>
        [...new Set([...(excludeTitles.length > 0 ? prev : []), ...results.map((r) => r.title)])].slice(-20),
      );
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
          setLastRequest({ ingredientsList, servingsOverride });
          setShownTitles((prev) =>
            [...new Set([...(excludeTitles.length > 0 ? prev : []), ...curated.map((r) => r.title)])].slice(-20),
          );
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

  const findRecipes = () => generateRecipes(ingredients);

  const findRecipesFromText = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    generateRecipes([trimmed], parseServingsHint(trimmed));
  };

  const tryAnotherSet = () => {
    if (!lastRequest) return;
    generateRecipes(lastRequest.ingredientsList, lastRequest.servingsOverride, shownTitles);
  };

  // "Surprise me" quick action + the mood chip row below — fills the
  // free-text box with a canned prompt and runs it through the exact same
  // generateRecipes() pipeline a hand-typed sentence would. No dedicated
  // no-input "random" endpoint exists, so this is the closest honest match
  // without inventing a new one (web counterpart: CookTodayForm.tsx's
  // runPrompt).
  const runPrompt = (text: string) => {
    setFreeText(text);
    generateRecipes([text], parseServingsHint(text));
  };

  // "Use These First" → "Show meal ideas" reuses the exact same
  // ingredient-chip picker "Cook with what I have" already drives — no
  // second ingredient-matching implementation.
  const cookWithPantryItems = () => {
    setIngredients((current) => [...new Set([...current, ...pantrySummary.map((p) => p.name)])]);
    setShowIngredientPicker(true);
  };

  const openRecipe = (recipe: RecipeView) => {
    setSelectedRecipe(recipe);
    setSaved(false);
    setSavedRecipeId(undefined);
    setHeroFailed(false);
    // A fresh recipe means a fresh ingredient check — last recipe's
    // readiness must not carry over and silently unlock this one's cooking.
    setIngredientsReady(false);
    setTimeWarningDismissed(false);
    setStep('detail');
    void trackEvent('cook_today_meal_selected');
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
    void trackEvent('cook_today_start_cooking');
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

        {/* Only ever present when the AI could genuinely estimate a distinct
            prep phase (see recipe-validation.ts's sanitizePrepTimeMinutes) —
            never a fabricated split of a bare total. */}
        {selectedRecipe.prepTimeMinutes ? (
          <Text style={styles.prepBreakdown}>
            Prep: {selectedRecipe.prepTimeMinutes} min · Cook: {selectedRecipe.cookTimeMinutes - selectedRecipe.prepTimeMinutes} min
          </Text>
        ) : null}

        {timeConstraint && selectedRecipe.cookTimeMinutes > timeConstraint && !timeWarningDismissed ? (
          <View style={styles.timeWarning}>
            <Text style={styles.timeWarningText}>
              This takes about {selectedRecipe.cookTimeMinutes} minutes —{' '}
              {selectedRecipe.cookTimeMinutes - timeConstraint} minutes longer than your {timeConstraint}-minute
              target.
            </Text>
            <View style={styles.timeWarningRow}>
              <Button
                label="Choose another meal"
                variant="secondary"
                onPress={() => setStep('results')}
                style={styles.timeWarningButton}
              />
              <Button
                label="Cook this anyway"
                onPress={() => setTimeWarningDismissed(true)}
                style={styles.timeWarningButton}
              />
            </View>
          </View>
        ) : null}

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

        {user ? (
          <FridgeCheck
            recipeIngredients={selectedRecipe.ingredients}
            onNavigateToShoppingList={(listId) => navigation.navigate('ShoppingList', { listId })}
            onReadyChange={setIngredientsReady}
          />
        ) : null}

        <Button
          label="Start Cooking"
          onPress={startCooking}
          disabled={!!user && !ingredientsReady}
          style={styles.actionSpacing}
        />
        {user && !ingredientsReady ? (
          <Text style={styles.emptyText}>
            Scan or skip the fridge check above, then tick off what you still need to buy, to unlock cooking.
          </Text>
        ) : null}
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
            {recipes.map((recipe, index) => {
              const image = getCuisineImage(recipe.cuisine);
              // Deterministic, AI-free — reasoning is derived from the
              // request the user just made (free text / picked ingredients /
              // time limit), never a new AI call per card.
              const match = describeRecipeMatch(recipe, {
                query: freeText.trim() || undefined,
                pickedIngredients: ingredients.length > 0 ? ingredients : undefined,
                timeConstraintMinutes: timeConstraint,
              });
              return (
                <FadeInView key={index} delay={index * 40}>
                  <Card onPress={() => openRecipe(recipe)} style={styles.resultCard}>
                    <View style={styles.resultCardInner}>
                      <Image source={{ uri: image.url }} accessibilityLabel={image.alt} style={styles.resultImage} />
                      <View style={styles.resultBody}>
                        {match.badge ? (
                          <View style={styles.matchBadge}>
                            <Text style={styles.matchBadgeText}>{match.badge}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.resultTitle}>{recipe.title}</Text>
                        <View style={styles.tagRow}>
                          <Tag label={`${recipe.cookTimeMinutes} min`} />
                          <Tag label={`${recipe.servings} servings`} />
                          {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                        </View>
                        <Text style={styles.resultReason}>{match.reason}</Text>
                      </View>
                    </View>
                  </Card>
                </FadeInView>
              );
            })}
            {recipes.length > 0 ? (
              <Button
                label="None of these? Try another set →"
                variant="tertiary"
                onPress={tryAnotherSet}
                style={styles.tryAnotherButton}
              />
            ) : null}
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

  // step === 'input' — the Cook tab root. FoodPadi's Pick cycles through the
  // rest of the already-fetched `ideaCards` list; Quick cook is the same
  // list filtered to ≤15 min. Both read-only derivations, no new fetch (web
  // counterpart: CookTodayForm.tsx).
  const bestMatchIndex = ideaCards.findIndex((i) => i.badge === 'Best match');
  const orderedPickIdeas =
    bestMatchIndex > 0
      ? [ideaCards[bestMatchIndex], ...ideaCards.slice(0, bestMatchIndex), ...ideaCards.slice(bestMatchIndex + 1)]
      : ideaCards;
  const pickIdea = orderedPickIdeas.length > 0 ? orderedPickIdeas[pickIndex % orderedPickIdeas.length] : null;
  const pickBadgeLabel = pickIdea ? (pickIdea.badge ?? (pickIdea.timeMinutes <= 20 ? 'Quick & Easy' : null)) : null;
  const quickCookIdeas = ideaCards.filter((i) => i.timeMinutes <= 15).slice(0, 3);

  // Tapping any idea card opens the full recipe for a signed-in member
  // (whose card carries one, see the load effect above); a guest's card has
  // none, so it prompts sign-in instead of silently doing nothing.
  const openIdea = (idea: IdeaCardData) => (idea.recipe ? openRecipe(idea.recipe) : onRequestLogin());

  const renderIdeaRow = (idea: IdeaCardData, key: string) => (
    <TouchableOpacity key={key} style={styles.ideaRow} onPress={() => openIdea(idea)} activeOpacity={0.85}>
      <Image source={{ uri: idea.image.url }} accessibilityLabel={idea.image.alt} style={styles.ideaRowImage} />
      <View style={styles.ideaRowBody}>
        <Text style={styles.ideaRowTitle} numberOfLines={2}>
          {idea.title}
        </Text>
        <Text style={styles.ideaRowMeta}>
          {idea.timeMinutes} min · {idea.difficulty}
          {idea.isVegan ? ' · 🌱 Vegan' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenHeader
        title="What are we cooking today?"
        subtitle="Tell FoodPadi what you want, what you have, or let us surprise you."
      />

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="e.g. Something quick with chicken…"
          placeholderTextColor={colors.textFaint}
          value={freeText}
          onChangeText={setFreeText}
          onSubmitEditing={findRecipesFromText}
          returnKeyType="search"
          autoComplete="off"
          autoCorrect
        />
        <TouchableOpacity style={styles.addButton} onPress={findRecipesFromText}>
          <Text style={styles.addButtonText}>✨ Cook</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Quick actions — every one reuses an existing handler/route; none of
          these introduces a new capability (web counterpart: CookTodayForm.tsx's
          quick-actions grid). */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => setShowIngredientPicker(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.quickActionIcon}>🥕</Text>
          <Text style={styles.quickActionLabel}>Cook with what I have</Text>
          <Text style={styles.quickActionSubtitle}>Use your ingredients and reduce waste</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => runPrompt('Surprise me with something good to cook')}
          activeOpacity={0.85}
        >
          <Text style={styles.quickActionIcon}>✨</Text>
          <Text style={styles.quickActionLabel}>Surprise me</Text>
          <Text style={styles.quickActionSubtitle}>Let FoodPadi choose for you</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('Plan')}
          activeOpacity={0.85}
        >
          <Text style={styles.quickActionIcon}>📅</Text>
          <Text style={styles.quickActionLabel}>Plan a meal</Text>
          <Text style={styles.quickActionSubtitle}>For the week or a special occasion</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('Favorites')}
          activeOpacity={0.85}
        >
          <Text style={styles.quickActionIcon}>❤️</Text>
          <Text style={styles.quickActionLabel}>My favourites</Text>
          <Text style={styles.quickActionSubtitle}>Quick access to your saved recipes</Text>
        </TouchableOpacity>
      </View>

      {/* Mood chips — canned prompts through the same free-text pipeline as
          the box above (see runPrompt / MOOD_CHIPS). */}
      <Text style={styles.sectionHeading}>What are you in the mood for?</Text>
      <View style={styles.chipWrap}>
        {MOOD_CHIPS.map((chip) => (
          <Chip key={chip.label} label={chip.label} selected={freeText === chip.text} onPress={() => runPrompt(chip.text)} />
        ))}
        {freeText.trim().length > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={() => setFreeText('')} accessibilityRole="button">
            <Text style={styles.clearButtonText}>✕ Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showIngredientPicker ? (
        <>
          <Text style={styles.sectionHeading}>Or tell me what you have</Text>

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

          <Button
            label="Cook Something"
            onPress={findRecipes}
            disabled={ingredients.length === 0}
            style={styles.actionSpacing}
          />
        </>
      ) : (
        <Button
          label="Or choose from what you have →"
          variant="tertiary"
          onPress={() => setShowIngredientPicker(true)}
          style={styles.actionSpacing}
        />
      )}

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

      {/* FoodPadi's Pick — starts on the one idea GET /home/ideas already
          flagged as this member's best match; "Try another" cycles through
          the rest of the same already-fetched list (web counterpart:
          CookTodayForm.tsx). */}
      {pickIdea ? (
        <Section title="✨ FoodPadi's Pick" style={styles.pickSection}>
          <Text style={styles.pickSubtitle}>
            A meal we think you&apos;ll love, based on your preferences and what you have.
          </Text>
          <Card onPress={() => openIdea(pickIdea)} style={styles.pickCard}>
            <Image
              source={{ uri: pickIdea.image.url }}
              accessibilityLabel={pickIdea.image.alt}
              style={styles.pickImage}
            />
            {pickBadgeLabel ? (
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{pickBadgeLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.pickTitle}>{pickIdea.title}</Text>
            <Text style={styles.ideaRowMeta}>
              {pickIdea.timeMinutes} min · {pickIdea.difficulty}
              {pickIdea.isVegan ? ' · 🌱 Vegan' : ''}
            </Text>
          </Card>
          {orderedPickIdeas.length > 1 ? (
            <Button
              label="↻ Try another"
              variant="tertiary"
              onPress={() => setPickIndex((i) => (i + 1) % orderedPickIdeas.length)}
              style={styles.tryAnotherButton}
            />
          ) : null}
        </Section>
      ) : null}

      {/* Real "Ideas for you" — same GET /home/ideas data Home shows on web
          (mobile Home has no equivalent section yet — see load effect above). */}
      {ideaCards.length > 0 ? (
        <Section title="Good ideas for you" aside="Based on what you have">
          {ideaCards.map((idea) => renderIdeaRow(idea, idea.title))}
        </Section>
      ) : null}

      {quickCookIdeas.length > 0 ? (
        <Section title="⚡ Quick cook" aside="15 minutes or less">
          {quickCookIdeas.map((idea) => renderIdeaRow(idea, `quick-${idea.title}`))}
        </Section>
      ) : null}

      {/* "Use These First" — the member's own oldest-added pantry items, a
          real if approximate stand-in for "needs using soon" (PantryItem has
          no expiry field — web counterpart: CookTodayForm.tsx). Members only;
          empty pantry shows its own honest empty state. */}
      {user ? (
        <Section title="♻️ Use these first">
          {pantrySummary.length === 0 ? (
            <Text style={styles.emptyText}>Nothing in your pantry yet — scan your fridge to get started.</Text>
          ) : (
            <>
              <Text style={styles.pantryHint}>These have been in your pantry the longest.</Text>
              {pantrySummary.map((item) => (
                <View key={item.id} style={styles.pantryRow}>
                  <Text style={styles.pantryName}>{item.name}</Text>
                  {item.quantityLabel ? <Text style={styles.pantryQuantity}>{item.quantityLabel}</Text> : null}
                </View>
              ))}
              <Button
                label="Show meal ideas →"
                variant="tertiary"
                onPress={cookWithPantryItems}
                style={styles.tryAnotherButton}
              />
            </>
          )}
        </Section>
      ) : null}

      {/* Recently cooked — same real GET /home/recently-cooked data Home's
          own list uses on web, laid out as a horizontal strip. Members only. */}
      {user ? (
        <Section title="Recently cooked">
          {recentlyCooked.length === 0 ? (
            <Text style={styles.emptyText}>Finish a Cook Today session and it&apos;ll show up here.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentlyCooked.map((item) => (
                <View key={item.id} style={styles.recentStripItem}>
                  <Image
                    source={{ uri: item.image.url }}
                    accessibilityLabel={item.image.alt}
                    style={styles.recentStripThumb}
                  />
                  <Text style={styles.recentStripTitle} numberOfLines={1}>
                    {item.isVegan ? '🌱 ' : ''}
                    {item.title}
                  </Text>
                  <Text style={styles.recentStripWhen}>
                    {item.daysAgo === 0 ? 'Today' : item.daysAgo === 1 ? '1 day ago' : `${item.daysAgo} days ago`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    sectionHeading: { ...typography.overline, color: c.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    clearButton: {
      marginLeft: 'auto',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
      backgroundColor: 'transparent',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
    },
    clearButtonText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
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
    tryAnotherButton: { marginTop: spacing.md },
    moreActions: { marginTop: spacing.lg, gap: spacing.xs },
    heroImage: {
      width: '100%',
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: c.surfaceSunken,
      marginBottom: spacing.md,
    },
    resultCard: { marginBottom: spacing.md },
    resultCardInner: { flexDirection: 'row', gap: spacing.md },
    resultImage: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
    },
    resultBody: { flex: 1 },
    matchBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginBottom: spacing.xs,
    },
    matchBadgeText: { fontSize: 11, fontWeight: '700', color: c.primary, letterSpacing: 0.2 },
    resultReason: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 17 },
    resultTitle: { ...typography.title, color: c.text, marginBottom: spacing.sm },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    prepBreakdown: { ...typography.caption, color: c.textMuted, marginBottom: spacing.lg },
    timeWarning: {
      backgroundColor: c.warningSoft,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    timeWarningText: { ...typography.body, color: c.text, marginBottom: spacing.md, lineHeight: 20 },
    timeWarningRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    timeWarningButton: { flexGrow: 1 },
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

    // --- Cook page redesign (web counterpart: CookTodayForm.tsx) ---
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    quickActionCard: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    quickActionIcon: { fontSize: 20, marginBottom: spacing.xs },
    quickActionLabel: { ...typography.body, fontWeight: '700', color: c.text, marginBottom: 2 },
    quickActionSubtitle: { ...typography.caption, color: c.textMuted, lineHeight: 16 },

    ideaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
    ideaRowImage: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.surfaceSunken },
    ideaRowBody: { flex: 1 },
    ideaRowTitle: { ...typography.body, fontWeight: '700', color: c.text, marginBottom: 2 },
    ideaRowMeta: { ...typography.caption, color: c.textMuted },

    pickSection: { marginTop: spacing.xl },
    pickSubtitle: { ...typography.caption, color: c.textMuted, marginBottom: spacing.md, lineHeight: 17 },
    pickCard: { padding: 0, overflow: 'hidden' },
    pickImage: { width: '100%', height: 160, backgroundColor: c.surfaceSunken },
    pickTitle: { ...typography.title, color: c.text, margin: spacing.md, marginBottom: spacing.xs },

    pantryHint: { ...typography.caption, color: c.textMuted, marginBottom: spacing.sm },
    pantryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    pantryName: { ...typography.body, color: c.text },
    pantryQuantity: { ...typography.caption, color: c.textMuted },

    recentStripItem: { width: 120, marginRight: spacing.md },
    recentStripThumb: {
      width: 120,
      height: 90,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
      marginBottom: spacing.xs,
    },
    recentStripTitle: { ...typography.caption, fontWeight: '700', color: c.text },
    recentStripWhen: { ...typography.caption, color: c.textFaint, fontSize: 11 },
  });
}
