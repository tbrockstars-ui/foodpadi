-- AlterTable
ALTER TABLE "billing_config" ADD COLUMN     "dealer_flw_plan_id" TEXT,
ADD COLUMN     "dealer_ngn_amount" INTEGER NOT NULL DEFAULT 7500,
ADD COLUMN     "dealer_price_cents" INTEGER NOT NULL DEFAULT 499,
ADD COLUMN     "dealer_stripe_price_id" TEXT;
