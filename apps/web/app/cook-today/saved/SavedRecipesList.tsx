'use client';

import { useState } from 'react';
import type { SavedRecipeView } from '@foodpadi/shared';
import styles from '../cook-today.module.css';

export function SavedRecipesList({ initialRecipes }: { initialRecipes: SavedRecipeView[] }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          <div key={recipe.id} className={styles.resultCard}>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : recipe.id)}
              style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
            >
              <p className={styles.resultTitle}>{recipe.title}</p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{recipe.cookTimeMinutes} min</span>
                <span className={styles.tag}>{recipe.servings} servings</span>
                {recipe.cuisine ? <span className={styles.tag}>{recipe.cuisine}</span> : null}
              </div>
            </button>

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
                  className={styles.secondaryButton}
                  onClick={() => removeRecipe(recipe.id)}
                  disabled={deletingId === recipe.id}
                  style={{ marginTop: 'var(--space-md)', color: 'var(--danger)', borderColor: 'var(--danger)' }}
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
