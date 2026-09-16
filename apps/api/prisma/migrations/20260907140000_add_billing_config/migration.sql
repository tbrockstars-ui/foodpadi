-- CreateTable
CREATE TABLE "billing_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "basePriceCents" INTEGER NOT NULL DEFAULT 499,
    "baseCurrency" TEXT NOT NULL DEFAULT 'usd',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "flwNgnAmount" INTEGER NOT NULL DEFAULT 7500,
    "currency_options" JSONB NOT NULL DEFAULT '{}',
    "stripe_price_id" TEXT,
    "flw_plan_id" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_config_pkey" PRIMARY KEY ("id")
);
