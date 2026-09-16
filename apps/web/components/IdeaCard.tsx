'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecipeView } from '@foodpadi/shared';
import { LikeHeart } from './LikeHeart';
import { LocalFoodSearch, type LocalFoodSearchStage } from '../app/eat-now/LocalFoodSearch';
import styles from '../app/home.module.css';
import type { ImageAsset } from '../lib/imageAssets';

export interface IdeaCardData {
  title: string;
  timeMinutes: number;
  difficulty: string;
  priceBand: string;
  priceEstimate: string | null;
  matchPercent: number | null;
  badge: string | null;
  /** See isVeganFood (packages/shared) — best-effort, title-based for a
   * recipe with no tags field. Rendered as its own pill alongside `badge`
   * (e.g. "Best match") rather than replacing it. */
  isVegan: boolean;
  image: ImageAsset;
  /** Present only for a signed-in member — the full recipe to show/save. */
  recipe?: RecipeView;
}

/**
 * One "Ideas for you" card. The image (and title) are clickable — a member
 * gets the full recipe in a modal (already fetched with the card, no extra
 * round trip); a guest (no `recipe`, see HomeHub.tsx's loadIdeaCards) gets a
 * lightweight "create an account to see this" prompt instead.
 *
 * `onStartCooking` is optional and additive — Home doesn't pass it, so
 * Home's cards are unchanged. Cook Today (docs Cook-page-redesign brief §9)
 * passes its existing `openRecipe` handler, which puts a real
 * "Start Cooking →" button directly on the card face (only when a full
 * `recipe` is present — a signed-in member) instead of requiring the modal
 * detour first. It drives the exact same detail/journey/cooking flow the
 * modal's "create account" path already assumes exists — no second cooking
 * implementation.
 */
export function IdeaCard({ idea, onStartCooking }: { idea: IdeaCardData; onStartCooking?: (recipe: RecipeView) => void }) {
  const [open, setOpen] = useState(false);
  // "Find Near Me" inside the modal — same real, geolocation-based
  // LocalFoodSearch used on Home's Decide results and Plan's "Get it" days,
  // so opening an idea gives a way to actually go get it, not just cook it.
  const [findNearMeOpen, setFindNearMeOpen] = useState(false);
  const [findNearMeStage, setFindNearMeStage] = useState<LocalFoodSearchStage>('idle');
  const findNearMeBusy = findNearMeStage === 'asking-permission' || findNearMeStage === 'searching';

  return (
    <>
      <div className={styles.ideaCard}>
        {/* A <div role="button">, not a <button> — LikeHeart below renders its
            own <button>, and a <button> can't validly contain another
            interactive control (nesting one caused a hydration mismatch). */}
        <div
          className={styles.ideaImageWrap}
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {idea.badge || idea.isVegan ? (
            <div className={styles.ideaBadges}>
              {idea.badge ? <span className={styles.ideaBadge}>{idea.badge}</span> : null}
              {idea.isVegan ? <span className={`${styles.ideaBadge} ${styles.ideaBadgeVegan}`}>Vegan</span> : null}
            </div>
          ) : null}
          <img src={idea.image.url} alt={idea.image.alt} className={styles.ideaImage} />
          <div className={styles.ideaHeart}>
            <LikeHeart label={idea.title} recipe={idea.recipe} />
          </div>
        </div>
        <button type="button" className={styles.ideaTitleButton} onClick={() => setOpen(true)}>
          <p className={styles.ideaTitle}>{idea.title}</p>
        </button>
        <p className={styles.ideaMeta}>
          {idea.timeMinutes} min · {idea.difficulty}
          {idea.priceEstimate ? <span className={styles.ideaPrice}> · {idea.priceEstimate}</span> : null}
        </p>
        {onStartCooking && idea.recipe ? (
          <button
            type="button"
            className={styles.ideaStartCookingButton}
            onClick={() => onStartCooking(idea.recipe!)}
          >
            Start Cooking <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className={styles.ideaModalBackdrop}
          onClick={() => {
            setOpen(false);
            setFindNearMeOpen(false);
          }}
        >
          <div className={styles.ideaModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.ideaModalClose}
              onClick={() => {
                setOpen(false);
                setFindNearMeOpen(false);
              }}
              aria-label="Close"
            >
              ✕
            </button>
            <img src={idea.image.url} alt={idea.image.alt} className={styles.ideaModalImage} />
            <h3 className={styles.ideaModalTitle}>{idea.title}</h3>
            <p className={styles.ideaMeta}>
              {idea.timeMinutes} min · {idea.difficulty}
              {idea.priceEstimate ? <span className={styles.ideaPrice}> · {idea.priceEstimate}</span> : null}
            </p>

            {/* Real, geolocation-based "find it nearby" — works whether or
                not this idea has a full recipe (guest or member alike), so
                it sits above the recipe/create-account split below. */}
            {findNearMeOpen ? (
              findNearMeBusy ? null : (
                <button type="button" className={styles.findNearMeButton} onClick={() => setFindNearMeOpen(false)}>
                  Hide
                </button>
              )
            ) : (
              <button type="button" className={styles.findNearMeButton} onClick={() => setFindNearMeOpen(true)}>
                Find Near Me
              </button>
            )}
            {findNearMeOpen ? (
              <div className={styles.ideaModalSection}>
                <LocalFoodSearch query={idea.title} autoStart onStageChange={setFindNearMeStage} />
              </div>
            ) : null}

            {idea.recipe ? (
              <>
                <p className={styles.ideaModalHeading}>Ingredients</p>
                <div className={styles.ideaModalSection}>
                  {idea.recipe.ingredients.map((ingredient, index) => (
                    <p key={index} className={styles.ideaModalLine}>
                      {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
                    </p>
                  ))}
                </div>
                <p className={styles.ideaModalHeading}>Steps</p>
                <div className={styles.ideaModalSection}>
                  {idea.recipe.steps.map((step, index) => (
                    <div key={index} className={styles.ideaModalStepRow}>
                      <span className={styles.ideaModalStepNumber}>{index + 1}</span>
                      <p className={styles.ideaModalLine}>{step}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.ideaModalSection}>
                <p className={styles.ideaModalLine}>Create a free account to see the full ingredients and steps.</p>
                <Link href="/register" className={styles.ideaModalCta}>
                  Create free account
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
