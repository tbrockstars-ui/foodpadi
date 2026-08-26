-- CreateTable
CREATE TABLE "food_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_session_id" TEXT,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cook_time_minutes" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "cuisine" TEXT,
    "steps" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai_generated',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_events_user_id_idx" ON "food_events"("user_id");

-- CreateIndex
CREATE INDEX "food_events_guest_session_id_idx" ON "food_events"("guest_session_id");

-- CreateIndex
CREATE INDEX "food_events_event_type_idx" ON "food_events"("event_type");

-- AddForeignKey
ALTER TABLE "food_events" ADD CONSTRAINT "food_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
