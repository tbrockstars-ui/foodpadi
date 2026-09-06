'use client';

import { useState } from 'react';
import type { RecipeView } from '@foodpadi/shared';
import styles from './LikeHeart.module.css';

/**
 * Favourite toggle (the Favorites engine — CookTodayService.toggleFavorite/
 * listFavorites) used on Home "Ideas for you" cards and Saved/Favorites list
 * rows. Two shapes of caller:
 *  - `recipeId` known (already-persisted, e.g. Saved Recipes): toggles the
 *    heart on that exact row via PATCH — un-hearting works here.
 *  - `recipe` only, no id yet (a Home idea not yet saved): the first tap
 *    saves it WITH the heart on in one call (SaveRecipeRequest.isFavorite),
 *    capturing the id it's handed back so a second tap can un-heart via the
 *    same PATCH path as above.
 * With neither (a guest, or a static fallback card) it's a local-only visual
 * toggle — guests can't persist anything (see guest_zero_ai_rule/[[foodpadi
 * decision engine]] posture: no account, no Memory).
 */
export function LikeHeart({
  initialLiked = false,
  label,
  variant = 'overlay',
  recipe,
  recipeId: initialRecipeId,
  onUnheart,
}: {
  initialLiked?: boolean;
  label: string;
  /** 'overlay' (default): dark circular chip for sitting on top of a photo.
      'plain': no background, for an inline row context (e.g. next to text). */
  variant?: 'overlay' | 'plain';
  /** The recipe to save-and-favourite when there's no id yet. Omit for guests / non-persistable cards. */
  recipe?: RecipeView;
  /** An already-persisted recipe's id — toggles in place instead of saving again. */
  recipeId?: string;
  /** Fires once the un-favourite PATCH succeeds — e.g. a Favorites list dropping the card immediately. */
  onUnheart?: () => void;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [saving, setSaving] = useState(false);
  const [recipeIdState, setRecipeIdState] = useState(initialRecipeId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;

    if (!recipe && !recipeIdState) {
      // Guest / non-persistable card — nothing to save, just a local toggle.
      setLiked((v) => !v);
      return;
    }

    const nextLiked = !liked;
    setSaving(true);
    setLiked(nextLiked); // optimistic

    try {
      if (recipeIdState) {
        const res = await fetch(`/api/proxy/cook-today/recipes/${recipeIdState}/favorite`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: nextLiked }),
        });
        if (!res.ok) {
          setLiked(!nextLiked); // put it back if the toggle didn't take
        } else if (!nextLiked) {
          onUnheart?.();
        }
      } else if (recipe) {
        // No id yet — save and favourite in the same call.
        const res = await fetch('/api/proxy/cook-today/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...recipe, isFavorite: true }),
        });
        if (res.ok) {
          const saved = (await res.json()) as { id: string };
          setRecipeIdState(saved.id);
        } else {
          setLiked(!nextLiked);
        }
      }
    } catch {
      setLiked(!nextLiked);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.heart} ${variant === 'plain' ? styles.plain : ''} ${liked ? styles.liked : ''}`}
      aria-pressed={liked}
      aria-label={liked ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      disabled={saving}
      onClick={handleClick}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} aria-hidden="true">
        <path
          d="M12 20.5s-7-4.35-9.5-8.75C.9 8.6 2.2 5 5.5 5c1.9 0 3.3 1 4.5 2.6C11.2 6 12.6 5 14.5 5c3.3 0 4.6 3.6 3 6.75C19 16.15 12 20.5 12 20.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
