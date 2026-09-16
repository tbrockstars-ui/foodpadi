-- Admin-approval-before-payment business rule (2026-09-11). Purely additive:
-- existing listing_status values ('draft'/'pending_review'/'active'/
-- 'suspended'/'expired') keep their exact current meaning and rows, so no
-- backfill is needed — 'approved'/'changes_requested'/'rejected' are simply
-- new values the application starts writing going forward.

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "approval_note" TEXT,
ADD COLUMN     "approval_reviewed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "dealer_audit_logs" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "admin_id" TEXT,
    "action" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dealer_audit_logs_dealer_id_created_at_idx" ON "dealer_audit_logs"("dealer_id", "created_at");

-- AddForeignKey
ALTER TABLE "dealer_audit_logs" ADD CONSTRAINT "dealer_audit_logs_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
