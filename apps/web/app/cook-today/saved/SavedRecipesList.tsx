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
  // Bulk-select for "delete several at once" — separate from expandedId/
  // deletingId above, which are both single-recipe concerns.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const removeRecipe = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/proxy/cook-today/recipes/${id}`, { method: 'DELETE' });
      setRecipes((current) => current.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
      setSelectedIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = recipes.length > 0 && selectedIds.size === recipes.length;
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(recipes.map((r) => r.id)) : new Set());
  };

  // Same single-recipe DELETE endpoint as removeRecipe above, just fired for
  // every selected id at once — there's no separate bulk-delete endpoint, and
  // one wasn't worth adding for a handful of recipes at a time.
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/proxy/cook-today/recipes/${id}`, { method: 'DELETE' })),
      );
      const removedIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
      setRecipes((current) => current.filter((r) => !removedIds.has(r.id)));
      if (expandedId && removedIds.has(expandedId)) setExpandedId(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of removedIds) next.delete(id);
        return next;
      });
    } finally {
      setBulkDeleting(false);
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
      <div className={styles.bulkBar}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={allSelected}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            aria-label="Select all saved recipes"
          />
          <span className={styles.bulkBarLabel}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
        </label>
        {selectedIds.size > 0 ? (
          <button
            type="button"
            className={styles.bulkDeleteButton}
            onClick={deleteSelected}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? 'Removing…' : `Remove ${selectedIds.size}`}
          </button>
        ) : null}
      </div>

      {recipes.map((recipe) => {
        const expanded = expandedId === recipe.id;
        const selected = selectedIds.has(recipe.id);
        return (
          <div key={recipe.id} className={styles.resultCard} style={{ position: 'relative' }}>
            <label
              className={styles.cardCheckbox}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${recipe.title}`}
            >
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={selected}
                onChange={(e) => toggleSelected(recipe.id, e.target.checked)}
              />
            </label>
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
              style={{ cursor: 'pointer', paddingRight: 32, paddingLeft: 32 }}
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
