# Database Schema (Proposal)

PostgreSQL. Conventions: every table has `id UUID PK`, `created_at`, `updated_at`; user-owned tables add `deleted_at TIMESTAMPTZ NULL` for soft delete. Foreign keys are `ON DELETE CASCADE` for owned child rows (e.g. `meal_plan_items` under `meal_plans`) and `ON DELETE RESTRICT`/`SET NULL` for shared reference data (e.g. `ingredients`).

## Core Identity & Household

```
users (id, email, auth_provider, created_at, updated_at, deleted_at)
user_profiles (id, user_id FK->users, display_name, onboarding_completed_at, disclaimer_acknowledged_at, created_at, updated_at)
households (id, name, created_by FK->users, created_at, updated_at)
household_members (id, household_id FK->households, user_id FK->users, role, joined_at)
```

## Preferences, Goals, Avoidances

```
food_preferences (id, user_id FK->users, cuisine, liked_meal, disliked_ingredient, texture_dislike, cooking_style, source ['explicit'|'inferred'], created_at, updated_at, deleted_at)
food_goals (id, user_id FK->users, goal_type ENUM['balanced_meals','eat_more_plants','quick_meals','reduce_spending','reduce_waste','home_cooked','explore_cuisines','cook_for_others','support_fitness','maintain_weight','personal','none'], created_at, updated_at)
avoided_ingredients (id, user_id FK->users, ingredient_id FK->ingredients, note NULLABLE /* free text, treated as potentially sensitive */, created_at, deleted_at)
```

## Food Data (Layer 1)

```
ingredients (id, name, category, common_allergen_flags[], created_at, updated_at)
recipes (id, title, source ['ai_generated'|'curated'], cook_time_minutes, servings, cuisine, created_by_user_id NULLABLE, created_at, updated_at, deleted_at)
recipe_ingredients (id, recipe_id FK->recipes, ingredient_id FK->ingredients, quantity, unit)
products (id, name, brand, retailer, price_pence, currency DEFAULT 'GBP', barcode NULLABLE, last_verified_at)
product_ingredients (id, product_id FK->products, ingredient_id FK->ingredients)
restaurants (id, name, location GEOGRAPHY NULLABLE, cuisine, price_band)
menu_items (id, restaurant_id FK->restaurants, name, price_pence, dietary_tags[])
```

## Planning

```
meal_plans (id, user_id FK->users, household_id NULLABLE FK->households, scope ENUM['today','3day','week','custom'], start_date, end_date, budget_pence NULLABLE, status ENUM['draft','accepted','completed','abandoned'], created_at, updated_at, deleted_at)
meal_plan_items (id, meal_plan_id FK->meal_plans, recipe_id NULLABLE FK->recipes, product_id NULLABLE FK->products, menu_item_id NULLABLE FK->menu_items, meal_slot ENUM['breakfast','lunch','dinner','snack'], planned_date, planned_time NULLABLE, servings, status ENUM['planned','cooked','skipped','swapped','rescued'], created_at, updated_at)
meal_feedback (id, meal_plan_item_id FK->meal_plan_items, user_id FK->users, rating ENUM['liked','disliked','neutral'], note NULLABLE, created_at)
```

## Pantry & Shopping

```
pantry_items (id, user_id FK->users, ingredient_id FK->ingredients, source ['scan'|'manual'|'purchase'], confirmed_by_user BOOLEAN DEFAULT false, likely_expiry_date NULLABLE, created_at, updated_at, deleted_at)
shopping_lists (id, user_id FK->users, meal_plan_id NULLABLE FK->meal_plans, status ENUM['open','completed'], created_at, updated_at)
shopping_list_items (id, shopping_list_id FK->shopping_lists, ingredient_id FK->ingredients, quantity, unit, estimated_price_pence NULLABLE, checked BOOLEAN DEFAULT false, added_manually BOOLEAN DEFAULT false)
food_purchases (id, user_id FK->users, shopping_list_item_id NULLABLE FK->shopping_list_items, product_id NULLABLE FK->products, price_pence NULLABLE, purchased_at)
```

## Behaviour, Reminders, Companion

```
food_events (id, user_id FK->users, event_type ENUM['eat_now_selected','meal_cooked','meal_skipped','plan_accepted','plan_rescued','shopping_completed', ...], reference_id NULLABLE, occurred_at)
reminders (id, user_id FK->users, type ENUM['meal_confirm','shopping_nearby','waste_alert','weekly_planning', ...], scheduled_for, delivered_at NULLABLE, dismissed_at NULLABLE, created_at)
notification_preferences (id, user_id FK->users, category, enabled BOOLEAN DEFAULT true, quiet_hours_start, quiet_hours_end, updated_at)
ai_conversations (id, user_id FK->users, role ENUM['user','assistant'], content, created_at) -- short-term, TTL-purged
ai_memory (id, user_id FK->users, key, value, source ENUM['explicit','inferred'], confidence NULLABLE, created_at, updated_at, deleted_at)
user_feedback (id, user_id FK->users, category, message, created_at)
```

## Subscriptions & Ops

```
subscriptions (id, user_id FK->users, plan ENUM['free','premium','family'], status ENUM['trial','active','cancelled','expired'], provider 'revenuecat', provider_ref, renews_at NULLABLE, created_at, updated_at)
audit_logs (id, actor_user_id NULLABLE, action, target_table, target_id, metadata JSONB, created_at)
```

## Notes

- `avoided_ingredients.note` and any free-text field a user can fill are treated as **potentially special-category data** per [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md) — encrypted at rest, excluded from default analytics exports.
- Pricing fields are stored in integer pence to avoid floating-point currency bugs; `currency` defaults to GBP per §29 (UK-first), schema leaves room for multi-currency later.
- `pantry_items.confirmed_by_user` defaults false and nothing reads a pantry item as "available" for recommendation until confirmed — enforces §14's "never silently assume."
- Row-Level Security policies (native Postgres, hosted on Neon) are applied per-table keyed on `user_id`/`household_id` membership as defence-in-depth; the API layer remains the primary authorization boundary (§25).
