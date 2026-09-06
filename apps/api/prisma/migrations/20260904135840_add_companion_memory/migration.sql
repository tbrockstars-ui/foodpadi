-- CreateTable
CREATE TABLE "food_patterns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "pattern_key" TEXT NOT NULL,
    "pattern_value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "first_observed_at" TIMESTAMP(3) NOT NULL,
    "last_observed_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_suggestions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "suggestion_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "action" TEXT,
    "actioned_at" TIMESTAMP(3),

    CONSTRAINT "companion_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_preferences" (
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "muted_types" TEXT[],
    "max_daily_suggestions" INTEGER NOT NULL DEFAULT 1,
    "max_weekly_suggestions" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "food_patterns_user_id_status_idx" ON "food_patterns"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "food_patterns_user_id_pattern_type_pattern_key_key" ON "food_patterns"("user_id", "pattern_type", "pattern_key");

-- CreateIndex
CREATE INDEX "companion_suggestions_user_id_generated_at_idx" ON "companion_suggestions"("user_id", "generated_at");

-- CreateIndex
CREATE INDEX "companion_suggestions_user_id_suggestion_type_idx" ON "companion_suggestions"("user_id", "suggestion_type");

-- AddForeignKey
ALTER TABLE "food_patterns" ADD CONSTRAINT "food_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_suggestions" ADD CONSTRAINT "companion_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_preferences" ADD CONSTRAINT "companion_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
