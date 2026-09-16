-- CreateTable
CREATE TABLE "cooking_journeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "recipe_snapshot" JSONB NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'recipe_selected',
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "ingredient_status" JSONB,
    "shopping_list_id" TEXT,
    "meal_plan_item_id" TEXT,
    "timer_status" TEXT,
    "timer_duration_seconds" INTEGER,
    "timer_ends_at" TIMESTAMP(3),
    "timer_remaining_seconds" INTEGER,
    "feedback_id" TEXT,
    "cooking_started_at" TIMESTAMP(3),
    "cooking_completed_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooking_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cooking_journeys_shopping_list_id_key" ON "cooking_journeys"("shopping_list_id");

-- CreateIndex
CREATE INDEX "cooking_journeys_user_id_status_idx" ON "cooking_journeys"("user_id", "status");

-- AddForeignKey
ALTER TABLE "cooking_journeys" ADD CONSTRAINT "cooking_journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_journeys" ADD CONSTRAINT "cooking_journeys_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_journeys" ADD CONSTRAINT "cooking_journeys_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_journeys" ADD CONSTRAINT "cooking_journeys_meal_plan_item_id_fkey" FOREIGN KEY ("meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
