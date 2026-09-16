-- AlterTable: multi-provider subscription support
ALTER TABLE "subscriptions"
    ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe',
    ADD COLUMN "flw_plan_id" TEXT,
    ADD COLUMN "flw_subscription_id" TEXT,
    ADD COLUMN "flw_tx_ref" TEXT,
    ADD COLUMN "flw_customer_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_flw_subscription_id_key" ON "subscriptions"("flw_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_flw_tx_ref_key" ON "subscriptions"("flw_tx_ref");

-- Rename the webhook idempotency ledger to reflect that it is now shared by
-- both payment providers, and add a provider discriminator.
ALTER TABLE "stripe_events" RENAME TO "webhook_events";
ALTER TABLE "webhook_events" RENAME CONSTRAINT "stripe_events_pkey" TO "webhook_events_pkey";
ALTER INDEX "stripe_events_type_idx" RENAME TO "webhook_events_type_idx";
ALTER TABLE "webhook_events" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';
