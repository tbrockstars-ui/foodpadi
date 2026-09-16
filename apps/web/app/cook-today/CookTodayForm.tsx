'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { CookingJourneyView, RecipeView } from '@foodpadi/shared';
import { describeRecipeMatch } from '@foodpadi/shared';
import styles from './cook-today.module.css';
// Reused as-is from Home's own hero/ideas/recently-cooked styling (see
// lib/homeIdeas.ts and HomeHub.tsx) — same design-system tokens, not a new
// visual language, so the two pages read as one product rather than the
// blank entry screen and the dashboard looking hand-built separately.
import homeStyles from '../home.module.css';
import { CookingSession } from './CookingSession';
import { ContinueCookingCard } from './ContinueCookingCard';
import { ScanKitchen } from './ScanKitchen';
import { FridgeCheck } from './FridgeCheck';
import { MemberBenefitCard } from '../../components/MemberBenefitCard';
import { IdeaCard } from '../../components/IdeaCard';
import { LikeHeart } from '../../components/LikeHeart';
import { guestPrompts } from '../../lib/guestClient';
import { getCuisineImage } from '../../lib/imageAssets';
import { trackClientEvent } from '../../lib/trackClientEvent';
import type { IdeaCardData, PantrySummaryItem, RecentlyCookedCardData } from '../../lib/homeIdeas';

// Best-effort "for N people/servings" lift from the free-text box into the
// existing `servings` field GenerateRecipesDto already accepts (currently
// hardcoded to 2 for the chip-picker path) — never fabricated, just forwards
// a number the user actually typed; no match leaves servings unset and lets
// the recipe generator's own default apply.
function parseServingsHint(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*(?:people|persons|servings?)/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

// Lightweight same-tab "don't lose my place" recovery (brief §28) — Cooking
// Mode has no backend session today, and the brief itself says not to build
// one unless necessary. sessionStorage survives a refresh but not a new
// tab/device; cleared the moment the user leaves the detail/cooking steps.
const SESSION_KEY = 'foodpadi.cookToday.session';

interface PersistedSession {
  step: 'detail' | 'cooking';
  selectedRecipe: RecipeView;
  savedRecipeId?: string;
}

function loadPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

// Grouped loosely (protein / carb / veg / dairy) for scannability, but kept
// as one flat tappable list — same simple chip-wrap layout as before, just
// more starting options so most people find something without typing.
const QUICK_INGREDIENTS = [
  'Chicken', 'Beef', 'Fish', 'Prawns', 'Eggs', 'Tofu', 'Beans',
  'Rice', 'Pasta', 'Noodles', 'Bread', 'Potatoes', 'Plantain',
  'Onions', 'Peppers', 'Tomatoes', 'Garlic', 'Spinach', 'Carrots', 'Broccoli', 'Mushrooms', 'Cabbage', 'Sweetcorn',
  'Cheese', 'Milk', 'Butter', 'Coconut milk',
];

const TIME_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'No limit', value: undefined },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

type Step = 'input' | 'results' | 'detail' | 'cooking';

// Mood chips on the blank entry screen — same "canned free text" pattern
// DecideFlow's own PROMPT_CHIPS already use (app/DecideFlow.tsx): picking
// one just fills the free-text box and runs it through the exact same
// generateRecipes() call a hand-typed sentence would. No new filter
// dimension, no new endpoint — Cook Today has always taken a free-text
// sentence as its `ingredients` array's one entry.
const MOOD_CHIPS: { label: string; text: string }[] = [
  { label: '⚡ Quick (15 min)', text: 'Something quick, ready in about 15 minutes' },
  { label: '🍲 Comfort Food', text: 'Comforting, home-style food' },
  { label: '🥗 Healthy & Fresh', text: 'Something healthy and fresh' },
  { label: '👨‍👩‍👧 Family Dinner', text: 'A family dinner everyone will like' },
  { label: '💰 Budget Friendly', text: 'Something cheap and budget-friendly' },
  { label: '🎲 Try Something New', text: "Something different from what I usually cook" },
];

// The proxy clears the session cookies and answers 401 when it can't refresh
// an expired access token. There's nothing to retry client-side — bounce the
// user through login and bring them back to Cook Today afterwards. A full
// navigation (not router.push) for the same reason app/login/page.tsx uses
// one: the App Router client cache can otherwise serve a stale render.
function redirectToLogin() {
  window.location.href = `/login?next=${encodeURIComponent('/cook-today')}`;
}

// NestJS error bodies are JSON ({ message: string | string[], ... }), but a
// bare 401 from the proxy (or a proxy/runtime error) can be empty or plain
// text — fall back to that, then to the status code, so the user never sees
// a contentless "something went wrong".
async function errorMessageFrom(res: Response, fallback: string): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const data = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join('. ');
    if (typeof data.message === 'string' && data.message) return data.message;
  } catch {
    // Not JSON — could be a genuine short plain-text body, but could equally
    // be a full HTML error page (a routing 404, a load-balancer/CDN error
    // page, ...). Never surface markup to the user: only trust the raw text
    // as a message when it's short and doesn't look like a document.
    const trimmed = raw.trim();
    if (trimmed && trimmed.length < 200 && !/^<(!doctype|html)/i.test(trimmed)) {
      return trimmed;
    }
  }
  return `${fallback} (error ${res.status})`;
}

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export function CookTodayForm({
  isGuest = false,
  initialJourney = null,
  ideaCards = [],
  recentlyCooked = [],
  pantrySummary = [],
}: {
  isGuest?: boolean;
  /** The signed-in user's active Cooking Journey, if any (docs cooking-journey
      brief). When present, the input step shows "Continue where you left off"
      instead of the blank "What do you want to cook?" (§14/§16/§36). */
  initialJourney?: CookingJourneyView | null;
  /** Real "Ideas for you" (GET /home/ideas) — same data and IdeaCard
      component Home shows, surfaced again here so the blank entry screen
      isn't just a bare text box. See lib/homeIdeas.ts. */
  ideaCards?: IdeaCardData[];
  /** Real "Recently cooked" (GET /home/recently-cooked) — members only,
      always [] for a guest. See lib/homeIdeas.ts. */
  recentlyCooked?: RecentlyCookedCardData[];
  /** Real, oldest-added pantry items (GET /pantry/items) — Cook Today's
      "Use These First" (docs Cook-page-redesign brief §15). See
      lib/homeIdeas.ts's loadPantrySummary for why "oldest" stands in for
      "needs using soon" (PantryItem has no expiry field). */
  pantrySummary?: PantrySummaryItem[];
}) {
  // Always starts at the SSR-safe default — sessionStorage doesn't exist on
  // the server, so reading it here (even lazily) would make the server and
  // client's first render disagree and React would throw a hydration error.
  // The rehydrate effect below reads sessionStorage instead, client-only,
  // immediately after mount.
  const [step, setStep] = useState<Step>('input');
  // Guests: shown once per visit under the results, and in place of the
  // save-recipe flow (which needs an account).
  const [showResultsBenefit, setShowResultsBenefit] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [customIngredient, setCustomIngredient] = useState('');
  // Seeded once from ?prompt= (a "Cook It" tap on a Decide result — see
  // DecideFlow.tsx) — same lazy-initializer, read-once-on-mount precedent as
  // DecideFlow's own ?mood= handling. The customer can still edit it; nothing
  // here submits automatically.
  const searchParams = useSearchParams();
  const [freeText, setFreeText] = useState(() => searchParams.get('prompt') ?? '');
  // The ingredient-chip picker (scan/chips/time-filter/"Cook Something")
  // stays collapsed by default — free text is the primary entry point, this
  // is the secondary "or browse by ingredient instead" path, revealed on
  // request rather than competing with the input box for attention.
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  // "↻ Try another" on FoodPadi's Pick (docs Cook-page-redesign brief §12) —
  // cycles through the same already-fetched `ideaCards`, never a new fetch.
  const [pickIndex, setPickIndex] = useState(0);
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
  // Where the detail screen's "‹ Back" should go — the results list only
  // exists when the user actually ran a search (openRecipe from a result
  // card). Opening a recipe straight from a dashboard card ("Good ideas for
  // you" / "FoodPadi's Pick") or resuming a journey never populated
  // `recipes`, so "back to results" would land on an empty/stale list —
  // back should return to the dashboard instead.
  const [detailSource, setDetailSource] = useState<'results' | 'dashboard'>('dashboard');
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
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(undefined);
  // The active Cooking Journey this cook is tracked against (docs cooking-
  // journey brief). Created lazily when a member opens a recipe; seeded from
  // the server on a resume. `journeyDismissed` hides the "Continue" card once
  // the user has explicitly chosen "Start something else".
  const [journeyId, setJourneyId] = useState<string | undefined>(undefined);
  const [journeyDismissed, setJourneyDismissed] = useState(false);
  const [resumeStepIndex, setResumeStepIndex] = useState<number | undefined>(undefined);
  const [resumeTimerRemaining, setResumeTimerRemaining] = useState<number | undefined>(undefined);
  const [resumeFinished, setResumeFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // True once the rehydrate-from-sessionStorage effect below has both run
  // AND its state updates have been applied to a render — this is real
  // React state (not a ref) specifically so it becomes true in the SAME
  // render as the rehydrated step/selectedRecipe values. A ref guard would
  // flip to "true" a render too early: the persist effect below would still
  // run with the stale pre-rehydrate closure values (step='input') from the
  // render it was scheduled in, immediately overwriting the very session it
  // was meant to protect.
  const [rehydrated, setRehydrated] = useState(false);

  // Client-only rehydrate — see the comment on the initial `step` state
  // above for why this can't happen in a useState initializer. When the
  // server handed us an active Cooking Journey, that is authoritative — the
  // "Continue" card drives the resume, so skip the sessionStorage fast-path
  // (and clear any stale copy) to avoid a race.
  useEffect(() => {
    if (initialJourney) {
      try {
        window.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
      setRehydrated(true);
      return;
    }

    // A signed-in user with NO active journey: the server is authoritative,
    // so any leftover local cook session is stale (a different account on this
    // device, or the pre-persistence bug). Clear it rather than rehydrate
    // someone else's recipe (docs cooking-journey brief §25) — and if it was
    // mid-recipe/mid-cook, that's the fingerprint of the old "lost my
    // progress" bug (§32).
    if (!isGuest) {
      const stale = loadPersistedSession();
      try {
        window.sessionStorage.removeItem(SESSION_KEY);
        window.sessionStorage.removeItem('foodpadi.cookToday.stepIndex');
      } catch {
        // ignore
      }
      if (stale && (stale.step === 'detail' || stale.step === 'cooking')) {
        trackClientEvent('cooking_journey_lost');
      }
      setRehydrated(true);
      return;
    }

    // Guests keep the sessionStorage fast-path (they have no server journey).
    const persisted = loadPersistedSession();
    if (persisted) {
      setStep(persisted.step);
      setSelectedRecipe(persisted.selectedRecipe);
      setSavedRecipeId(persisted.savedRecipeId);
    }
    setRehydrated(true);
  }, []);

  // Keeps sessionStorage in step with the two pieces of state above — a
  // refresh mid-recipe (detail step) or mid-cook (cooking step) re-enters
  // the same recipe instead of dropping back to the free-text/chip picker.
  // Cleared once the user backs out to results/input, so a stale recipe
  // never reappears after they've deliberately moved on.
  useEffect(() => {
    if (!rehydrated) return;
    if ((step === 'detail' || step === 'cooking') && selectedRecipe) {
      const toStore: PersistedSession = { step, selectedRecipe, savedRecipeId };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(toStore));
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }, [step, selectedRecipe, savedRecipeId, rehydrated]);

  const toggleIngredient = (name: string) => {
    setIngredients((current) => (current.includes(name) ? current.filter((i) => i !== name) : [...current, name]));
  };

  const addCustomIngredient = () => {
    const trimmed = customIngredient.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((current) => [...current, trimmed]);
    }
    setCustomIngredient('');
  };

  // Shared by both entry points below: the ingredient-chip picker (existing)
  // and the free-text "What do you want to cook?" box (new) — same request
  // to the same endpoint either way, matching DecideService's own precedent
  // of sending a whole free-text sentence as the `ingredients` array's one
  // entry (apps/api/src/modules/decide/decide.service.ts).
  //
  // `excludeTitles` powers "None of these? Try another set" — a fresh
  // request (findRecipes/findRecipesFromText) always passes [] and that
  // resets shownTitles below; tryAnotherSet resubmits the *same* request
  // with every title shown so far excluded, so repeated clicks keep
  // surfacing new options rather than looping the same few.
  const generateRecipes = async (ingredientsList: string[], servingsOverride?: number, excludeTitles: string[] = []) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/cook-today/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ingredientsList,
          timeConstraintMinutes: timeConstraint,
          servings: servingsOverride ?? 2,
          excludeTitles: excludeTitles.length > 0 ? excludeTitles : undefined,
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error("Cook Today isn't ready yet — the recipe generator isn't configured. Check back soon.");
        }
        throw new Error(await errorMessageFrom(res, 'Something went wrong finding recipes'));
      }
      const results = (await res.json()) as RecipeView[];
      setRecipes(results);
      setLastRequest({ ingredientsList, servingsOverride });
      // Accumulate across "Try another set" clicks (excludeTitles.length > 0)
      // so the same options never resurface while the curated pool still has
      // fresh ones to offer; a brand-new request starts the list over. Capped
      // well under the API's own 30-item ceiling — nobody needs more than the
      // last ~20 titles remembered for this to keep working.
      setShownTitles((prev) =>
        [...new Set([...(excludeTitles.length > 0 ? prev : []), ...results.map((r) => r.title)])].slice(-20),
      );
      setStep('results');
      if (isGuest && !guestPrompts.hasSeen('cook_results')) {
        setShowResultsBenefit(true);
        guestPrompts.markSeen('cook_results');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong finding recipes.');
    } finally {
      setLoading(false);
    }
  };

  const findRecipes = () => generateRecipes(ingredients, 2);

  const findRecipesFromText = () => {
    const trimmed = freeText.trim();
    if (trimmed.length < 3) return;
    generateRecipes([trimmed], parseServingsHint(trimmed));
  };

  const tryAnotherSet = () => {
    if (!lastRequest) return;
    generateRecipes(lastRequest.ingredientsList, lastRequest.servingsOverride, shownTitles);
  };

  // Start a server-side Cooking Journey for a fresh Cook Today result so the
  // cook survives navigation / logout / app close. Members only; guests keep
  // the in-memory flow. Fire-and-forget — journey tracking must never block
  // opening the recipe.
  const startJourney = async (recipe: RecipeView) => {
    if (isGuest) return;
    try {
      const res = await fetch('/api/proxy/cooking-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }),
      });
      if (res.ok) {
        const j = (await res.json()) as CookingJourneyView;
        setJourneyId(j.id);
        setSavedRecipeId(j.recipeId ?? undefined);
      }
      // 409 (ACTIVE_JOURNEY_EXISTS) can't normally happen: the input step
      // hides the free-text entry while a journey is active. If it does, the
      // old journey is kept and this cook just isn't tracked.
    } catch {
      // ignore
    }
  };

  // Re-enter the exact place the user left their active journey.
  const resumeJourney = () => {
    const j = initialJourney;
    if (!j) return;
    setSelectedRecipe(j.recipe);
    setSavedRecipeId(j.recipeId ?? undefined);
    setJourneyId(j.id);
    setTimeWarningDismissed(true);
    setDetailSource('dashboard'); // resuming never came from a results list
    if (j.destination === 'cooking' || j.destination === 'feedback_pending') {
      setResumeStepIndex(j.currentStep);
      setResumeTimerRemaining(j.timer?.remainingSeconds);
      setResumeFinished(j.destination === 'feedback_pending');
      setStep('cooking');
    } else {
      // recipe_selected / ingredient_check / ready_to_cook → the detail screen.
      setIngredientsReady(j.destination === 'ready_to_cook');
      setStep('detail');
    }
  };

  // "Start something else" from the Continue card — cancel the old journey
  // (never silently destroyed, §17: the card itself was the confirmation) and
  // reveal the normal "What do you want to cook?" entry.
  const handleStartSomethingElse = async () => {
    if (initialJourney) {
      try {
        await fetch(`/api/proxy/cooking-journey/${initialJourney.id}/cancel`, { method: 'POST' });
      } catch {
        // ignore — worst case the card reappears on next load
      }
    }
    setJourneyId(undefined);
    setJourneyDismissed(true);
  };

  const openRecipe = (recipe: RecipeView, source: 'results' | 'dashboard' = 'results') => {
    setSelectedRecipe(recipe);
    setDetailSource(source);
    setSaved(false);
    setSavedRecipeId(undefined);
    setSaveError(null);
    // A fresh recipe means a fresh ingredient check — last recipe's readiness
    // must not carry over and silently unlock this one's Start Cooking.
    setIngredientsReady(false);
    setTimeWarningDismissed(false);
    setResumeStepIndex(undefined);
    setResumeTimerRemaining(undefined);
    setResumeFinished(false);
    setStep('detail');
    trackClientEvent('cook_today_meal_selected');
    void startJourney(recipe);
  };

  const saveRecipe = async () => {
    if (!selectedRecipe) return;
    if (isGuest) {
      // Saving needs an account — show the value, don't bounce straight to a
      // login screen (guest-mode brief §6).
      setShowSavePrompt(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/proxy/cook-today/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRecipe),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        throw new Error(await errorMessageFrom(res, "Couldn't save this recipe"));
      }
      const savedRecipe = (await res.json()) as { id: string };
      setSaved(true);
      setSavedRecipeId(savedRecipe.id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save this recipe.");
    } finally {
      setSaving(false);
    }
  };

  if (step === 'cooking' && selectedRecipe) {
    return (
      <div className={styles.narrowColumn}>
        <CookingSession
          recipe={selectedRecipe}
          savedRecipeId={savedRecipeId}
          isGuest={isGuest}
          onClose={() => setStep('detail')}
          journeyId={journeyId}
          initialStepIndex={resumeStepIndex}
          initialTimerRemainingSeconds={resumeTimerRemaining}
          initialFinished={resumeFinished}
        />
      </div>
    );
  }

  if (step === 'detail' && selectedRecipe) {
    return (
      <div className={styles.narrowColumn}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setStep(detailSource === 'results' ? 'results' : 'input')}
          style={{ marginBottom: 16 }}
        >
          {detailSource === 'results' ? '‹ Back to results' : '‹ Back to Cook Today'}
        </button>
        <h1 className={styles.title}>{selectedRecipe.title}</h1>
        <div className={styles.tagRow}>
          <span className={styles.tag}>{selectedRecipe.cookTimeMinutes} min</span>
          <span className={styles.tag}>{selectedRecipe.servings} servings</span>
          {selectedRecipe.cuisine ? <span className={styles.tag}>{selectedRecipe.cuisine}</span> : null}
        </div>

        {/* Only ever present when the AI could genuinely estimate a distinct
            prep phase (see recipe-validation.ts's sanitizePrepTimeMinutes) —
            never a fabricated split of a bare total. */}
        {selectedRecipe.prepTimeMinutes ? (
          <p className={styles.prepBreakdown}>
            Prep: {selectedRecipe.prepTimeMinutes} min · Cook: {selectedRecipe.cookTimeMinutes - selectedRecipe.prepTimeMinutes} min
          </p>
        ) : null}

        {timeConstraint && selectedRecipe.cookTimeMinutes > timeConstraint && !timeWarningDismissed ? (
          <div className={styles.timeWarning}>
            <p className={styles.timeWarningText}>
              This takes about {selectedRecipe.cookTimeMinutes} minutes —{' '}
              {selectedRecipe.cookTimeMinutes - timeConstraint} minutes longer than your {timeConstraint}-minute
              target.
            </p>
            <div className={styles.timeWarningRow}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep('results')}>
                Choose another meal
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => setTimeWarningDismissed(true)}>
                Cook this anyway
              </button>
            </div>
          </div>
        ) : null}

        <p className={styles.sectionHeading}>Ingredients</p>
        <div className={styles.section}>
          {selectedRecipe.ingredients.map((ingredient, index) => (
            <p key={index} className={styles.ingredientLine}>
              {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
            </p>
          ))}
        </div>

        <p className={styles.sectionHeading}>Steps</p>
        <div className={styles.section}>
          {selectedRecipe.steps.map((stepText, index) => (
            <div key={index} className={styles.stepRow}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <p className={styles.stepText}>{stepText}</p>
            </div>
          ))}
        </div>

        <p className={styles.safetyNotice}>
          Food information only. FoodPadi does not monitor allergies, allergic reactions or medical
          conditions and does not determine whether food is medically safe for you.
        </p>

        {/* Account-only, same gate ScanKitchen already has. Reports back up
            via ingredientsReady, which gates Start Cooking below for a
            signed-in user — guests skip this whole subsystem and stay
            ungated (see the button's disabled expression). */}
        {!isGuest ? (
          <FridgeCheck
            /* Remount per journey/recipe so a resumed check hydrates cleanly
               and a different recipe never inherits the last one's state. */
            key={journeyId ?? selectedRecipe.title}
            recipeIngredients={selectedRecipe.ingredients}
            onReadyChange={setIngredientsReady}
            journeyId={journeyId}
            initialState={journeyId === initialJourney?.id ? initialJourney?.ingredientState ?? null : null}
            initialShoppingListId={
              journeyId === initialJourney?.id ? initialJourney?.shoppingList?.id ?? null : null
            }
          />
        ) : null}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            setStep('cooking');
            setResumeStepIndex(undefined);
            setResumeFinished(false);
            trackClientEvent('cook_today_start_cooking');
            if (journeyId) {
              void fetch(`/api/proxy/cooking-journey/${journeyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: 'cooking', currentStep: 0 }),
              }).catch(() => undefined);
            }
          }}
          disabled={!isGuest && !ingredientsReady}
        >
          Start Cooking
        </button>
        {!isGuest && !ingredientsReady ? (
          <p className={styles.emptyText} style={{ marginTop: 'var(--space-xs)' }}>
            Scan or skip the fridge check above, then tick off what you still need to buy, to unlock cooking.
          </p>
        ) : null}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={saveRecipe}
          disabled={saved || saving}
          style={{ marginTop: 'var(--space-sm)' }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save this recipe'}
        </button>
        {saveError ? <p className={styles.errorText}>{saveError}</p> : null}
        {showSavePrompt ? (
          <MemberBenefitCard
            icon="🔖"
            title="Want FoodPadi to remember this?"
            body="Create a free account to save recipes, keep your preferences and open them again on your other devices."
            ctaLabel="Create free account"
          />
        ) : null}
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className={styles.narrowColumn}>
        <h1 className={styles.title}>A few things you could cook</h1>
        {recipes.length === 0 ? (
          <p className={styles.emptyText}>
            No recipes match that combination. Try a longer time limit, or a few different ingredients.
          </p>
        ) : (
          recipes.map((recipe, index) => {
            const image = getCuisineImage(recipe.cuisine);
            // Deterministic, AI-free — reasoning is derived from the request
            // the user just made (free text / picked ingredients / time
            // limit), never a new AI call per card (see recipeMatchReason.ts).
            const match = describeRecipeMatch(recipe, {
              query: freeText.trim() || undefined,
              pickedIngredients: ingredients.length > 0 ? ingredients : undefined,
              timeConstraintMinutes: timeConstraint,
            });
            return (
              <button key={index} type="button" className={styles.resultCard} onClick={() => openRecipe(recipe)}>
                <div className={styles.resultCardInner}>
                  <img className={styles.resultImage} src={image.url} alt={image.alt} />
                  <div className={styles.resultBody}>
                    {match.badge ? <span className={styles.matchBadge}>{match.badge}</span> : null}
                    <p className={styles.resultTitle}>{recipe.title}</p>
                    <div className={styles.tagRow}>
                      <span className={styles.tag}>{recipe.cookTimeMinutes} min</span>
                      <span className={styles.tag}>{recipe.servings} servings</span>
                      {recipe.cuisine ? <span className={styles.tag}>{recipe.cuisine}</span> : null}
                    </div>
                    <p className={styles.resultReason}>{match.reason}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
        {recipes.length > 0 ? (
          <button type="button" className={styles.linkButton} onClick={tryAnotherSet} disabled={loading}>
            {loading ? 'Finding more…' : 'None of these? Try another set →'}
          </button>
        ) : null}
        {showResultsBenefit ? (
          <MemberBenefitCard
            icon="🔖"
            title="Don't lose these"
            body="Create a free account and FoodPadi keeps your recipes so you can cook them again anytime."
            ctaLabel="Create free account"
          />
        ) : null}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setStep('input')}
          style={{ marginTop: 'var(--space-md)' }}
        >
          Start over
        </button>
      </div>
    );
  }

  // State B (brief §36): an active journey exists — show "Continue where you
  // left off" instead of the blank entry. "Start something else" on the card
  // cancels it and drops through to State A below.
  if (!isGuest && initialJourney && !journeyDismissed) {
    return (
      <div className={styles.narrowColumn}>
        <ContinueCookingCard
          journey={initialJourney}
          onResume={resumeJourney}
          onStartSomethingElse={handleStartSomethingElse}
        />
      </div>
    );
  }

  // "Surprise me" quick action — fills the free-text box with a canned
  // prompt and runs it through the exact same generateRecipes() pipeline a
  // hand-typed sentence would (no dedicated no-input "random" endpoint
  // exists, so this is the closest honest match to the reference design's
  // card without inventing a new one — see MOOD_CHIPS above for the same
  // pattern). Also used by the mood chip row below.
  const runPrompt = (text: string) => {
    setFreeText(text);
    generateRecipes([text], parseServingsHint(text));
  };

  // FoodPadi's Pick — starts on the one idea GET /home/ideas already flagged
  // as this member's best match (see lib/homeIdeas.ts), not a separately-
  // fetched recommendation; "Try another" (pickIndex) cycles through the
  // rest of the same already-fetched list. Quick cook — the same real ideas,
  // just filtered to ≤15 minutes. All read-only derivations of `ideaCards`,
  // no new data.
  const bestMatchIndex = ideaCards.findIndex((i) => i.badge === 'Best match');
  const orderedPickIdeas =
    bestMatchIndex > 0
      ? [ideaCards[bestMatchIndex], ...ideaCards.slice(0, bestMatchIndex), ...ideaCards.slice(bestMatchIndex + 1)]
      : ideaCards;
  const pickIdea = orderedPickIdeas.length > 0 ? orderedPickIdeas[pickIndex % orderedPickIdeas.length] : null;
  // A real-data-derived label, never fabricated — "Best match" wins when
  // set; otherwise a genuinely quick recipe (≤20 min) earns "Quick & Easy".
  const pickBadgeLabel = pickIdea ? (pickIdea.badge ?? (pickIdea.timeMinutes <= 20 ? 'Quick & Easy' : null)) : null;
  const quickCookIdeas = ideaCards.filter((i) => i.timeMinutes <= 15).slice(0, 3);

  // "Use These First" → "Show meal ideas" reuses the exact same
  // ingredient-chip picker "Cook with what I have" already drives — no
  // second ingredient-matching implementation.
  const cookWithPantryItems = () => {
    setIngredients((current) => [...new Set([...current, ...pantrySummary.map((p) => p.name)])]);
    setShowIngredientPicker(true);
  };

  return (
    <div>
      {/* Full-width, above everything else — not sharing a row with the
          aside column below, so the prompt is the very first thing on the
          page regardless of viewport width. */}
      <div className={homeStyles.header}>
        <h1 className={styles.title} style={{ margin: 0 }}>
          What are we cooking today?
        </h1>
      </div>
      <p className={styles.subtitle}>Tell FoodPadi what you want, what you have, or let us surprise you.</p>

      {/* Same card + full-width-input + button-below shape as Home's own
          DecideFlow (.decideSection/.searchBar/.decideInput/
          .decideButtonRow/.searchButton) — the prompt field fills the
          card's whole width instead of being squeezed by a
          button on the same row, exactly how Home does it. */}
      <div className={homeStyles.decideSection}>
        <div className={homeStyles.searchBar}>
          <input
            className={homeStyles.decideInput}
            type="text"
            placeholder="e.g. Something quick with chicken…"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') findRecipesFromText();
            }}
          />
        </div>
        <div className={homeStyles.decideButtonRow}>
          <button
            type="button"
            className={homeStyles.searchButton}
            onClick={findRecipesFromText}
            disabled={freeText.trim().length < 3 || loading}
          >
            <span aria-hidden="true">✨</span> {loading ? 'Finding…' : 'Cook'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {/* Everything else — the rest of the features — sits below the prompt
          in its own two-column grid (main + aside). */}
      <div className={homeStyles.hubGrid}>
      <div className={homeStyles.hubMain}>
        {/* Quick actions — every one reuses an existing handler/route; none
            of these introduces a new capability. Accent colours are purely
            presentational (home.module.css's additive .quickAction* classes).
            Forced to a 2x2 square (not Home's auto-fit row) via the
            additive .quickActionsGridSquare modifier — Home's own quick
            actions (a different item count) keep their existing shape. */}
        <div className={`${homeStyles.quickActionsGrid} ${homeStyles.quickActionsGridSquare}`} style={{ marginTop: 'var(--space-lg)' }}>
          <button
            type="button"
            className={`${homeStyles.quickActionCard} ${homeStyles.quickActionCardAccent} ${homeStyles.quickActionGreen}`}
            onClick={() => setShowIngredientPicker(true)}
          >
            <span className={homeStyles.quickActionIconChip} aria-hidden="true">🥕</span>
            <span className={homeStyles.quickActionLabel}>Cook with what I have</span>
            <span className={homeStyles.quickActionSubtitle}>Use your ingredients and reduce waste</span>
            <span className={homeStyles.quickActionArrow} aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className={`${homeStyles.quickActionCard} ${homeStyles.quickActionCardAccent} ${homeStyles.quickActionPurple}`}
            onClick={() => runPrompt('Surprise me with something good to cook')}
            disabled={loading}
          >
            <span className={homeStyles.quickActionIconChip} aria-hidden="true">✨</span>
            <span className={homeStyles.quickActionLabel}>Surprise me</span>
            <span className={homeStyles.quickActionSubtitle}>Let FoodPadi choose for you</span>
            <span className={homeStyles.quickActionArrow} aria-hidden="true">→</span>
          </button>
          <Link
            href="/plan"
            className={`${homeStyles.quickActionCard} ${homeStyles.quickActionCardAccent} ${homeStyles.quickActionAmber}`}
          >
            <span className={homeStyles.quickActionIconChip} aria-hidden="true">📅</span>
            <span className={homeStyles.quickActionLabel}>Plan a meal</span>
            <span className={homeStyles.quickActionSubtitle}>For the week or a special occasion</span>
            <span className={homeStyles.quickActionArrow} aria-hidden="true">→</span>
          </Link>
          <Link
            href="/favorites"
            className={`${homeStyles.quickActionCard} ${homeStyles.quickActionCardAccent} ${homeStyles.quickActionBlue}`}
          >
            <span className={homeStyles.quickActionIconChip} aria-hidden="true">❤️</span>
            <span className={homeStyles.quickActionLabel}>My favourites</span>
            <span className={homeStyles.quickActionSubtitle}>Quick access to your saved recipes</span>
            <span className={homeStyles.quickActionArrow} aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Mood chips — canned prompts through the same free-text pipeline
            as the box above (see runPrompt / MOOD_CHIPS). */}
        <p className={styles.sectionHeading}>What are you in the mood for?</p>
        <div className={homeStyles.chipRow}>
          {MOOD_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`${homeStyles.promptChip} ${freeText === chip.text ? homeStyles.promptChipSelected : ''}`}
              onClick={() => runPrompt(chip.text)}
              disabled={loading}
            >
              {chip.label}
            </button>
          ))}
          {freeText.trim().length > 0 ? (
            <button type="button" className={homeStyles.clearButton} onClick={() => setFreeText('')}>
              ✕ Clear
            </button>
          ) : null}
        </div>

        {showIngredientPicker ? (
          <>
            <p className={styles.sectionHeading} style={{ marginTop: 'var(--space-xl)' }}>
              Or tell me what you have
            </p>
            <p className={styles.subtitle}>Scan it, tap what you have, or add something else.</p>

            {!isGuest ? (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <ScanKitchen onAddIngredients={(names) => setIngredients((current) => [...new Set([...current, ...names])])} />
              </div>
            ) : null}

            <div className={styles.chipWrap}>
              {QUICK_INGREDIENTS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.chip} ${ingredients.includes(name) ? styles.chipSelected : ''}`}
                  onClick={() => toggleIngredient(name)}
                >
                  {name}
                </button>
              ))}
              {ingredients
                .filter((i) => !QUICK_INGREDIENTS.includes(i))
                .map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`${styles.chip} ${styles.chipSelected}`}
                    onClick={() => toggleIngredient(name)}
                  >
                    {name} ✕
                  </button>
                ))}
            </div>

            <div className={styles.addRow}>
              <input
                className={styles.addInput}
                type="text"
                placeholder="Add something else"
                value={customIngredient}
                onChange={(e) => setCustomIngredient(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomIngredient();
                }}
              />
              <button type="button" className={styles.addButton} onClick={addCustomIngredient}>
                Add
              </button>
            </div>

            <p className={styles.sectionHeading}>How much time have you got?</p>
            <div className={styles.chipWrap}>
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`${styles.chip} ${timeConstraint === option.value ? styles.chipSelected : ''}`}
                  onClick={() => setTimeConstraint(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={findRecipes}
                disabled={ingredients.length === 0 || loading}
              >
                {loading ? 'Finding recipes…' : 'Cook Something'}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className={styles.linkButton}
            style={{ marginTop: 'var(--space-xl)' }}
            onClick={() => setShowIngredientPicker(true)}
          >
            Or choose from what you have →
          </button>
        )}

        {/* Real "Ideas for you" — same GET /home/ideas data and IdeaCard
            component Home shows (see lib/homeIdeas.ts, app/cook-today/page.tsx).
            onStartCooking wires the existing openRecipe flow directly onto
            each card face (members only — see IdeaCard's own gate). */}
        {ideaCards.length > 0 ? (
          <>
            <div className={homeStyles.ideasHeader}>
              <h2 className={homeStyles.ideasHeading}>Good ideas for you</h2>
            </div>
            <p className={homeStyles.ideasSubtext}>Based on what you cook, what you have and what you usually enjoy.</p>
            <div className={homeStyles.ideasGrid}>
              {ideaCards.map((idea) => (
                <IdeaCard key={idea.title} idea={idea} onStartCooking={(recipe) => openRecipe(recipe, 'dashboard')} />
              ))}
            </div>
          </>
        ) : null}

        {/* Recently cooked — a compact horizontal strip at the bottom of the
            main column (docs Cook-page-redesign brief §11), same real
            GET /home/recently-cooked data Home's own aside list uses (see
            lib/homeIdeas.ts) — just laid out differently here. Members only. */}
        {!isGuest ? (
          <>
            <div className={homeStyles.recentHeader} style={{ marginTop: 'var(--space-xl)' }}>
              <p className={homeStyles.recentHeading}>Recently cooked</p>
              <Link href="/cook-today/saved" className={homeStyles.recentViewAll}>
                View all
              </Link>
            </div>
            {recentlyCooked.length === 0 ? (
              <p className={homeStyles.recentEmpty}>Finish a Cook Today session and it&apos;ll show up here.</p>
            ) : (
              <div className={homeStyles.recentStrip}>
                {recentlyCooked.map((item) => (
                  <div key={item.id} className={homeStyles.recentStripItem}>
                    <span className={homeStyles.recentThumbWrap}>
                      <img src={item.image.url} alt="" className={homeStyles.recentStripThumb} />
                      {item.isVegan ? (
                        <span className={homeStyles.recentThumbVegan} role="img" aria-label="Vegan" title="Vegan">
                          🌱
                        </span>
                      ) : null}
                    </span>
                    <p className={homeStyles.recentStripTitle}>{item.title}</p>
                    <p className={homeStyles.recentStripWhen}>
                      {item.daysAgo === 0 ? 'Today' : item.daysAgo === 1 ? '1 day ago' : `${item.daysAgo} days ago`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className={homeStyles.hubAside}>
        {pickIdea ? (
          <div className={homeStyles.pickCard} style={{ padding: 'var(--space-md)' }}>
            <div className={homeStyles.pickHeader}>
              <h2 className={homeStyles.ideasHeading} style={{ marginBottom: 4 }}>
                <span aria-hidden="true">✨</span> FoodPadi&apos;s Pick
              </h2>
            </div>
            <p className={homeStyles.ideasSubtext}>
              A meal we think you&apos;ll love, based on your preferences and what you have.
            </p>
            {pickBadgeLabel ? <span className={homeStyles.pickBadge}>{pickBadgeLabel}</span> : null}
            <IdeaCard idea={pickIdea} onStartCooking={(recipe) => openRecipe(recipe, 'dashboard')} />
            {orderedPickIdeas.length > 1 ? (
              <button
                type="button"
                className={homeStyles.pickTryAnother}
                onClick={() => setPickIndex((i) => (i + 1) % orderedPickIdeas.length)}
              >
                <span aria-hidden="true">↻</span> Try another
              </button>
            ) : null}
          </div>
        ) : null}

        {quickCookIdeas.length > 0 ? (
          <div className={homeStyles.recentCard}>
            <div className={homeStyles.recentHeader}>
              <p className={homeStyles.recentHeading}>⚡ Quick cook · 15 minutes or less</p>
            </div>
            {quickCookIdeas.map((idea) => (
              <div key={idea.title} className={homeStyles.recentRow}>
                <span className={homeStyles.recentThumbWrap}>
                  <img src={idea.image.url} alt="" className={homeStyles.recentThumb} />
                </span>
                <div className={homeStyles.recentBody}>
                  <p className={homeStyles.recentTitle}>{idea.title}</p>
                  <p className={homeStyles.recentWhen}>{idea.timeMinutes} min</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* "Use These First" (brief §15) — the member's own oldest-added
            pantry items (GET /pantry/items), a real if approximate stand-in
            for "needs using soon" (PantryItem has no expiry field — see
            lib/homeIdeas.ts's loadPantrySummary). Members only; empty pantry
            shows its own honest empty state rather than fabricated items. */}
        {!isGuest ? (
          <div className={homeStyles.recentCard}>
            <div className={homeStyles.recentHeader}>
              <p className={homeStyles.recentHeading}>♻️ Use these first</p>
            </div>
            {pantrySummary.length === 0 ? (
              <p className={homeStyles.recentEmpty}>
                Nothing in your pantry yet — scan your fridge to get started.
              </p>
            ) : (
              <>
                <p className={styles.subtitle} style={{ margin: '0 0 var(--space-sm)', fontSize: 12 }}>
                  These have been in your pantry the longest.
                </p>
                <div className={homeStyles.pantryList}>
                  {pantrySummary.map((item) => (
                    <div key={item.id} className={homeStyles.pantryRow}>
                      <p className={homeStyles.pantryName}>{item.name}</p>
                      {item.quantityLabel ? <p className={homeStyles.pantryQuantity}>{item.quantityLabel}</p> : null}
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.linkButton} style={{ marginTop: 8 }} onClick={cookWithPantryItems}>
                  Show meal ideas →
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
