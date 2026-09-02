-- CreateTable
CREATE TABLE "referral_milestones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "reached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMP(3),

    CONSTRAINT "referral_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_milestones_user_id_idx" ON "referral_milestones"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_milestones_user_id_kind_tier_key" ON "referral_milestones"("user_id", "kind", "tier");

-- AddForeignKey
ALTER TABLE "referral_milestones" ADD CONSTRAINT "referral_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
