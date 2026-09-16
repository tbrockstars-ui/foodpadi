-- CreateTable
CREATE TABLE "fx_rate_snapshots" (
    "id" TEXT NOT NULL DEFAULT 'latest',
    "base_currency" TEXT NOT NULL DEFAULT 'usd',
    "rates" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rate_snapshots_pkey" PRIMARY KEY ("id")
);
