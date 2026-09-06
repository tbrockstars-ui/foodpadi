-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "last_cooked_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "recipes_created_by_user_id_last_cooked_at_idx" ON "recipes"("created_by_user_id", "last_cooked_at");
