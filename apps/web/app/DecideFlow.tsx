'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { isVeganFood, type DecideResponse, type DecisionOptionView } from '@foodpadi/shared';
import { LocalFoodSearch, type LocalFoodSearchStage } from './eat-now/LocalFoodSearch';
import { AiThinking } from '../components/motion/AiThinking';
import { FoodImage } from '../components/FoodImage';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { ShareNudge } from '../components/ShareNudge';
import { AdSlot } from '../components/AdSlot';
import { guestPrompts } from '../lib/guestClient';
import { trackLocalFoodSearchInteraction } from '../lib/localFoodSearchTracking';
import styles from './home.module.css';

type Stage = 'idle' | 'deciding' | 'options' | 'no-options' | 'error';

// Quick-start prompts (brief section 8) — each just fills the same
// description field the user could type into by hand, so nothing about the
// underlying /decide call changes; they're a faster on-ramp, not a
// different flow.
const PROMPT_CHIPS = [
  { label: "I'm hungry", text: "I'm hungry, surprise me" },
  { label: 'Something quick', text: 'Something quick to make' },
  { label: 'Something cheap', text: 'Something cheap and filling' },
  { label: 'Something comforting', text: 'Something comforting' },
  { label: 'Vegan', text: 'Something vegan' },
  { label: 'Try something new', text: 'Something different from usual' },
  { label: 'Surprise me', text: 'Surprise me with something different' },
];

// A "Get it" option carries real dietary tags (option.foodIdea.tags); a
// "Cook it" option's RecipeView has no tags field at all — isVeganFood
// (packages/shared) falls back to the option's own title/reason text for
// that case, which reliably says so when it's true (the AI/curated titles
// are written that way already).
function isVeganOption(option: DecisionOptionView): boolean {
  return isVeganFood({ tags: option.foodIdea?.tags, title: option.title, reason: option.reason });
}

// A function (not a static object) so it can drop the translateY move and
// the stagger delay under prefers-reduced-motion — an opacity-only,
// all-at-once fade instead of cards visibly travelling up the screen one
// after another (brief §20: "avoid repeated movement").
const optionVariants = (prefersReducedMotion: boolean) => ({
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0.15 }
      : { duration: 0.4, delay: i * 0.12, ease: 'easeOut' as const },
  }),
});

/**
 * "FoodPadi decides" — the Understand Context -> Decide layer of the
 * intent-first decision engine, sitting above the existing Right now /
 * Cooking / Plan ahead cards (see the decision-engine architecture memory).
 * Blends real Cook Today + Eat Now results into a small set of explained
 * options via POST /decide, rather than making the user pick a mode first.
 */
export function DecideFlow({ isGuest = false }: { isGuest?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Seeded from the URL (once, on first render) rather than always starting
  // blank — otherwise loading e.g. "/?mood=vegan" directly (a shared link,
  // or just refreshing) would show vegan-filtered Ideas-for-you for one
  // instant, then the sync effect below sees this component's own
  // description as blank and immediately deletes ?mood= again, silently
  // reverting the very state that got the user here.
  const [description, setDescription] = useState(() => searchParams.get('mood') ?? '');
  const [budgetPounds, setBudgetPounds] = useState(() => searchParams.get('maxBudget') ?? '');
  const [stage, setStage] = useState<Stage>('idle');
  const [options, setOptions] = useState<DecisionOptionView[]>([]);
  // Guests only: shown under the options once they've decided a couple of
  // times (§12), then never again this visit (§13).
  const [showBenefit, setShowBenefit] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [getSearchStage, setGetSearchStage] = useState<LocalFoodSearchStage>('idle');
  const prefersReducedMotion = useReducedMotion();

  // Bumped on every decide() call; a response whose id no longer matches is
  // stale (the user changed their selection mid-request) and is discarded so
  // an earlier call can't overwrite the results of a later one.
  const requestSeq = useRef(0);

  // A search actively in flight shouldn't be interruptible via "Hide" —
  // there's nothing meaningful to collapse back to yet.
  const getSearchBusy = getSearchStage === 'asking-permission' || getSearchStage === 'searching';
  const handleGetSearchStageChange = useCallback((s: LocalFoodSearchStage) => setGetSearchStage(s), []);

  // Reflects the current description/budget into the URL's ?mood=&maxBudget=
  // — the same query params HomeHub.tsx's "Ideas for you" already reads
  // server-side (see loadIdeaCards/ideasSearchParams there); this is the
  // wiring that comment says wasn't connected yet. Debounced so typing
  // doesn't fire a navigation on every keystroke, and doesn't touch
  // /decide's own request at all — Ideas-for-you re-ranks independently of
  // whether "Decide for me" has been pressed.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const mood = description.trim();
      if (mood) params.set('mood', mood);
      else params.delete('mood');

      const budget = Math.round(Number(budgetPounds));
      if (budgetPounds.trim() && Number.isFinite(budget) && budget > 0) params.set('maxBudget', String(budget));
      else params.delete('maxBudget');

      const qs = params.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
      if (next !== current) router.replace(next, { scroll: false });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, budgetPounds]);

  // Wipe any options/error/empty-state currently on screen back to the blank
  // slate. Used whenever the inputs change so a stale result set for the
  // previous selection is never left showing next to a different selection.
  const clearResults = () => {
    requestSeq.current += 1; // abandon any in-flight decide response
    setStage('idle');
    setOptions([]);
    setExpandedId(null);
    setErrorMessage(null);
    setGetSearchStage('idle');
  };

  const hasResultsShowing =
    stage === 'options' || stage === 'no-options' || stage === 'error' || stage === 'deciding';

  const decide = async (overrideDescription?: string) => {
    const trimmed = (overrideDescription ?? description).trim();
    if (trimmed.length < 3) return;

    const reqId = (requestSeq.current += 1);
    setStage('deciding');
    setErrorMessage(null);
    setExpandedId(null);
    setOptions([]); // clear the previous selection's results immediately
    setGetSearchStage('idle');
    try {
      const res = await fetch('/api/proxy/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmed,
          budgetPence: budgetPounds ? Math.round(Number(budgetPounds) * 100) : undefined,
        }),
      });
      if (reqId !== requestSeq.current) return; // superseded by a newer selection
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        if (reqId !== requestSeq.current) return;
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        setErrorMessage(message ?? "FoodPadi couldn't decide right now. Please try again.");
        setStage('error');
        return;
      }
      const data = (await res.json()) as DecideResponse;
      if (reqId !== requestSeq.current) return;
      // "Find Near Me" brief §14/§15 — Decide's results are "find it nearby"
      // only now; filtered here rather than in the request itself, so
      // /decide's own contract and tests are untouched.
      const getOptions = data.options.filter((o) => o.type === 'get');
      setOptions(getOptions);
      setStage(getOptions.length > 0 ? 'options' : 'no-options');
      if (isGuest && getOptions.length > 0) {
        const count = guestPrompts.bumpCount('decide_options');
        if (count >= 2 && !guestPrompts.hasSeen('decide_options')) {
          setShowBenefit(true);
          guestPrompts.markSeen('decide_options');
        }
      }
    } catch {
      if (reqId !== requestSeq.current) return;
      setErrorMessage("FoodPadi couldn't decide right now. Please try again.");
      setStage('error');
    }
  };

  const pickChip = (text: string) => {
    if (text === description) return;
    setDescription(text);
    // A chip is a fresh, self-contained prompt ("I'm hungry, surprise me") —
    // any budget constraint typed for the previous selection shouldn't
    // silently carry over and narrow it.
    setBudgetPounds('');
    // Picking a chip clears any results already on screen and re-enables
    // "Decide for me" rather than auto-firing a new decide() — the user
    // asked for a chance to add constraints (time/budget) or just review
    // the new selection before running it, not an immediate re-run.
    clearResults();
  };

  // Editing the free-text or the constraints invalidates whatever was decided
  // for the old values — drop the stale cards, but don't auto-fire on every
  // keystroke; the user hits "Decide for me" when ready.
  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    // Same reasoning as pickChip: typing a new description is a fresh
    // prompt, so a constraint left over from a previous one shouldn't
    // silently narrow it.
    setBudgetPounds('');
    if (hasResultsShowing) clearResults();
  };
  const handleConstraintChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    if (hasResultsShowing) clearResults();
  };

  const hasSomethingToClear = description.trim().length > 0 || budgetPounds.trim().length > 0 || hasResultsShowing;

  // Resets the whole flow back to blank — the text field, budget, and any
  // results/error on screen — rather than just the input, so it reads as
  // "start over" and never leaves a stale card sitting under an empty field.
  const clearAll = () => {
    setDescription('');
    setBudgetPounds('');
    clearResults();
  };

  return (
    <div className={styles.decideSection}>
      <div className={styles.searchBar}>
        <input
          className={styles.decideInput}
          type="text"
          placeholder="Tell me what you want to eat…"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && decide()}
        />
      </div>

      <div className={styles.chipRow}>
        {PROMPT_CHIPS.map((chip) => (
          <motion.button
            key={chip.label}
            type="button"
            className={`${styles.promptChip} ${description === chip.text ? styles.promptChipSelected : ''}`}
            onClick={() => pickChip(chip.text)}
            whileTap={{ scale: 0.95 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
          >
            {chip.label}
          </motion.button>
        ))}
        {hasSomethingToClear ? (
          <button type="button" className={styles.clearButton} onClick={clearAll}>
            ✕ Clear
          </button>
        ) : null}
      </div>

      <div className={styles.constraintsRow}>
        <div className={styles.constraintField}>
          {budgetPounds ? <span className={styles.constraintAffixPrefix}>£</span> : null}
          <input
            className={`${styles.constraintInput} ${budgetPounds ? styles.constraintInputHasPrefix : ''}`}
            type="number"
            min={0}
            step={0.5}
            placeholder="Budget £"
            value={budgetPounds}
            onChange={(e) => handleConstraintChange(setBudgetPounds, e.target.value)}
          />
        </div>
      </div>

      <div className={styles.decideButtonRow}>
        <motion.button
          type="button"
          className={styles.searchButton}
          onClick={() => decide()}
          disabled={description.trim().length < 3 || stage === 'deciding'}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span aria-hidden="true">✨</span> {stage === 'deciding' ? 'Deciding…' : 'Decide for me'}
        </motion.button>
      </div>

      {stage === 'deciding' ? <AiThinking /> : null}

      {stage === 'error' ? (
        <motion.div
          className={styles.stateBlock}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.stateIcon} aria-hidden="true">
            😕
          </span>
          <p className={styles.stateMessage}>{errorMessage}</p>
          <button type="button" className={styles.stateRetry} onClick={() => decide()}>
            Try again
          </button>
        </motion.div>
      ) : null}
      {stage === 'no-options' ? (
        <motion.div
          className={styles.stateBlock}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.stateIcon} aria-hidden="true">
            🤔
          </span>
          <p className={styles.stateMessage}>
            FoodPadi couldn&apos;t put together a good option for that. Try describing it differently.
          </p>
        </motion.div>
      ) : null}

      {stage === 'options'
        ? options.map((option, index) => (
            <motion.div
              key={option.id}
              className={styles.optionCard}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={optionVariants(!!prefersReducedMotion)}
            >
              <FoodImage
                image={option.image}
                alt={option.title}
                className={styles.optionImage}
                eager={index === 0}
                badge={isVeganOption(option) ? 'Vegan' : undefined}
              />

              <div className={styles.optionHeader}>
                <div>
                  <p className={styles.optionTitle}>{option.title}</p>
                  <p className={styles.optionReason}>{option.reason}</p>
                </div>
              </div>

              {/* Every result gets two independent actions: "Cook It" sends
                  the exact title to Cook Today's free-text box (the customer
                  still has to hit its own Cook button — nothing here
                  auto-generates a recipe), and "Find Nearby" is the existing
                  CTA, untouched — clicking it immediately searches for this
                  already-selected food near the user (LocalFoodSearch's
                  autoStart below); it never re-asks what food to look for. */}
              <div className={styles.optionActionsRow}>
                <button
                  type="button"
                  className={styles.optionAction}
                  onClick={() => router.push(`/cook-today?prompt=${encodeURIComponent(option.title)}`)}
                >
                  Cook It
                </button>
                {expandedId === option.id ? (
                  getSearchBusy ? null : (
                    <button
                      type="button"
                      className={styles.optionAction}
                      onClick={() => {
                        setGetSearchStage('idle');
                        setExpandedId(null);
                      }}
                    >
                      Hide
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={styles.findNearMeButton}
                    onClick={() => {
                      trackLocalFoodSearchInteraction('find_near_me_clicked', { query: option.title });
                      setGetSearchStage('idle');
                      setExpandedId(option.id);
                    }}
                  >
                    Find Nearby
                  </button>
                )}
              </div>

              {expandedId === option.id ? (
                <div className={styles.optionDetail}>
                  <LocalFoodSearch query={option.title} autoStart onStageChange={handleGetSearchStageChange} />
                </div>
              ) : null}
            </motion.div>
          ))
        : null}

      {isGuest && stage === 'options' && showBenefit ? (
        <MemberBenefitCard
          icon="🧠"
          title="Want suggestions based on what you like?"
          body="Right now FoodPadi is just exploring ideas. Tell it your cuisines, your budget and what you avoid, and it decides around you."
          ctaLabel="Personalise FoodPadi"
        />
      ) : null}
      {isGuest && stage === 'options' ? <AdSlot placement="decide_results" /> : null}

      {/* Members: nudge to pass FoodPadi on right after it's proved useful
          (strategy §4/§5 — referral is a key acquisition channel). */}
      {!isGuest && stage === 'options' ? <ShareNudge context="decision" /> : null}
    </div>
  );
}
