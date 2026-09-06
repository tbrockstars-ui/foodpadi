'use client';

import { useState } from 'react';
import type { SavedRecipeView } from '@foodpadi/shared';
import styles from '../cook-today/cook-today.module.css';
import { CookingSession } from '../cook-today/CookingSession';
import { LikeHeart } from '../../components/LikeHeart';

/**
 * The Favorites engine's read view — recipes with the heart on OR a 5-star
 * COOK rating (CookTodayService.listFavorites). A recipe can be here with
 * `isFavorite: false` (it qualified purely on rating) — the caption below
 * makes that visible rather than leaving an unexplained un-hearted card in a
 * "Favorites" list.
 */
export function FavoritesList({ initialFavorites }: { initialFavorites: SavedRecipeView[] }) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<SavedRecipeView | null>(null);

  // The heart optimistically flips the flag but this list itself is scoped
  // to "current favorites" — drop a card the moment it's un-hearted so the
  // list reflects the action immediately (a recipe that also has a
  // qualifying 5-star rating will simply reappear on the next full load,
  // which is an acceptable edge case rather than something worth a second
  // round trip to check here).
  const handleUnheart = (id: string) => {
    setFavorites((current) => current.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  if (cookingRecipe) {
    return (
      <CookingSession
        recipe={cookingRecipe}
        savedRecipeId={cookingRecipe.id}
        isGuest={false}
        onClose={() => setCookingRecipe(null)}
      />
    );
  }

  if (favorites.length === 0) {
    return (
      <p className={styles.emptyText}>
        Nothing here yet — heart a recipe you love, or rate one 5 stars after cooking it.
      </p>
    );
  }

  return (
    <>
      {favorites.map((recipe) => {
        const expanded = expandedId === recipe.id;
        return (
          <div key={recipe.id} className={styles.resultCard} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)' }}>
              <LikeHeart
                label={recipe.title}
                recipeId={recipe.id}
                initialLiked={recipe.isFavorite}
                onUnheart={() => handleUnheart(recipe.id)}
              />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(expanded ? null : recipe.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedId(expanded ? null : recipe.id);
                }
              }}
              style={{ cursor: 'pointer', paddingRight: 32 }}
            >
              <p className={styles.resultTitle}>{recipe.title}</p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{recipe.cookTimeMinutes} min</span>
                <span className={styles.tag}>{recipe.servings} servings</span>
                {recipe.cuisine ? <span className={styles.tag}>{recipe.cuisine}</span> : null}
              </div>
              {!recipe.isFavorite ? (
                <p className={styles.ideaPrice} style={{ margin: 0 }}>
                  ⭐ Here because you rated it 5 stars
                </p>
              ) : null}
            </div>

            {expanded ? (
              <div className={styles.section} style={{ marginTop: 'var(--space-md)' }}>
                <p className={styles.sectionHeading}>Ingredients</p>
                {recipe.ingredients.map((ingredient, i) => (
                  <p key={i} className={styles.ingredientLine}>
                    {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                    {ingredient.unit ? `${ingredient.unit} ` : ''}
                    {ingredient.name}
                  </p>
                ))}

                <p className={styles.sectionHeading}>Steps</p>
                {recipe.steps.map((step, i) => (
                  <div key={i} className={styles.stepRow}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <span className={styles.stepText}>{step}</span>
                  </div>
                ))}

                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setCookingRecipe(recipe)}
                  style={{ marginTop: 'var(--space-md)' }}
                >
                  Start Cooking
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
