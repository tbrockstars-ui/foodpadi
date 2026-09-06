-- CreateTable
CREATE TABLE "food_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[],
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "food_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_feedback_user_id_idx" ON "food_feedback"("user_id");

-- CreateIndex
CREATE INDEX "food_feedback_entity_type_entity_id_idx" ON "food_feedback"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "food_feedback" ADD CONSTRAINT "food_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
