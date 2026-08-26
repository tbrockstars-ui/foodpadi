-- Multi-select Food & Lifestyle Goals: a user's active goal set becomes 0-3
-- rows (isActive = true), exactly one flagged isPrimary. History is kept —
-- old rows are deactivated, never deleted.
ALTER TABLE "food_goals" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "food_goals" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "food_goals" ADD COLUMN "note" TEXT;

CREATE INDEX "food_goals_user_id_is_active_idx" ON "food_goals"("user_id", "is_active");

-- Backfill existing single-goal data: deactivate everything, then reactivate
-- and mark primary only each user's most recent goal row. This preserves
-- existing users' goal as goals=[existing_goal], primary_goal=existing_goal.
UPDATE "food_goals" SET "is_active" = false;

UPDATE "food_goals" fg
SET "is_active" = true, "is_primary" = true
FROM (
  SELECT DISTINCT ON (user_id) id
  FROM "food_goals"
  ORDER BY user_id, created_at DESC
) latest
WHERE fg.id = latest.id;
