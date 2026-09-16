-- AlterTable: admin-tunable payment-failure grace / dunning window.
-- Default 3 days — a failed renewal keeps Premium briefly instead of an
-- instant downgrade (standard subscription-app behaviour). The existing
-- STRIPE_PAST_DUE_GRACE_DAYS env var still overrides this when set.
ALTER TABLE "billing_config"
  ADD COLUMN "pastDueGraceDays" INTEGER NOT NULL DEFAULT 3;
