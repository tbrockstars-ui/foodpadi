'use client';

import { useState } from 'react';
import type { RecipeView } from '@foodpadi/shared';
import styles from './cook-today.module.css';

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

type Step = 'input' | 'results' | 'detail';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export function CookTodayForm() {
  const [step, setStep] = useState<Step>('input');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [customIngredient, setCustomIngredient] = useState('');
  const [timeConstraint, setTimeConstraint] = useState<number | undefined>(undefined);
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const findRecipes = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/cook-today/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, timeConstraintMinutes: timeConstraint, servings: 2 }),
      });
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error("Cook Today isn't ready yet — the recipe generator isn't configured. Check back soon.");
        }
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong finding recipes.');
      }
      setRecipes((await res.json()) as RecipeView[]);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong finding recipes.');
    } finally {
      setLoading(false);
    }
  };

  const openRecipe = (recipe: RecipeView) => {
    setSelectedRecipe(recipe);
    setSaved(false);
    setStep('detail');
  };

  const saveRecipe = async () => {
    if (!selectedRecipe) return;
    setSaving(true);
    try {
      await fetch('/api/proxy/cook-today/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRecipe),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'detail' && selectedRecipe) {
    return (
      <div>
        <button type="button" className={styles.secondaryButton} onClick={() => setStep('results')} style={{ marginBottom: 16 }}>
          ‹ Back to results
        </button>
        <h1 className={styles.title}>{selectedRecipe.title}</h1>
        <div className={styles.tagRow}>
          <span className={styles.tag}>{selectedRecipe.cookTimeMinutes} min</span>
          <span className={styles.tag}>{selectedRecipe.servings} servings</span>
          {selectedRecipe.cuisine ? <span className={styles.tag}>{selectedRecipe.cuisine}</span> : null}
        </div>

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

        <button type="button" className={styles.primaryButton} onClick={saveRecipe} disabled={saved || saving}>
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save this recipe'}
        </button>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div>
        <h1 className={styles.title}>A few things you could cook</h1>
        {recipes.length === 0 ? (
          <p className={styles.emptyText}>
            No recipes match that combination. Try a longer time limit, or a few different ingredients.
          </p>
        ) : (
          recipes.map((recipe, index) => (
            <button key={index} type="button" className={styles.resultCard} onClick={() => openRecipe(recipe)}>
              <p className={styles.resultTitle}>{recipe.title}</p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{recipe.cookTimeMinutes} min</span>
                <span className={styles.tag}>{recipe.servings} servings</span>
                {recipe.cuisine ? <span className={styles.tag}>{recipe.cuisine}</span> : null}
              </div>
            </button>
          ))
        )}
        <button type="button" className={styles.secondaryButton} onClick={() => setStep('input')}>
          Start over
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.title}>What have you got?</h1>
      <p className={styles.subtitle}>Tap what you have, or add something else.</p>

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
            <button key={name} type="button" className={`${styles.chip} ${styles.chipSelected}`} onClick={() => toggleIngredient(name)}>
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

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div style={{ marginTop: 24 }}>
        <button type="button" className={styles.primaryButton} onClick={findRecipes} disabled={ingredients.length === 0 || loading}>
          {loading ? 'Finding recipes…' : 'Find recipes'}
        </button>
      </div>
    </div>
  );
}
