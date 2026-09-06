'use client';

import { useState } from 'react';
import type { SavedRecipeView } from '@foodpadi/shared';
import styles from '../cook-today.module.css';
import { CookingSession } from '../CookingSession';
import { LikeHeart } from '../../../components/LikeHeart';

export function SavedRecipesList({ initialRecipes }: { initialRecipes: SavedRecipeView[] }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<SavedRecipeView | null>(null);

  const removeRecipe = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/proxy/cook-today/recipes/${id}`, { method: 'DELETE' });
      setRecipes((current) => current.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (cookingRecipe) {
    // Saved Recipes is member-only (guests can't save), so isGuest is always
    // false here; the recipe already has a real id, so CookingSession skips
    // its own auto-save-on-entry step entirely.
    return (
      <CookingSession
        recipe={cookingRecipe}
        savedRecipeId={cookingRecipe.id}
        isGuest={false}
        onClose={() => setCookingRecipe(null)}
      />
    );
  }

  if (recipes.length === 0) {
    return (
      <p className={styles.emptyText}>
        Nothing saved yet — save a recipe from Cook Today or import one from a link to see it here.
      </p>
    );
  }

  return (
    <>
      {recipes.map((recipe) => {
        const expanded = expandedId === recipe.id;
        return (
          <div key={recipe.id} className={styles.resultCard} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)' }}>
              <LikeHeart label={recipe.title} recipeId={recipe.id} initialLiked={recipe.isFavorite} />
            </div>
            {/* A <div role="button">, not a <button> — LikeHeart above renders
                its own <button>, and nesting one inside another is invalid
                HTML (causes a hydration mismatch). */}
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
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => removeRecipe(recipe.id)}
                  disabled={deletingId === recipe.id}
                  style={{ marginTop: 'var(--space-sm)', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  {deletingId === recipe.id ? 'Removing…' : 'Remove from saved'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
