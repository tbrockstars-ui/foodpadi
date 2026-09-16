-- CreateTable
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dealer_type" TEXT NOT NULL,
    "phone" TEXT,
    "website_url" TEXT,
    "order_url" TEXT,
    "whatsapp" TEXT,
    "opening_hours" JSONB,
    "categories" TEXT[],
    "cuisines" TEXT[],
    "product_keywords" TEXT[],
    "dietary_tags" TEXT[],
    "service_type" TEXT[],
    "listing_status" TEXT NOT NULL DEFAULT 'draft',
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_locations" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "label" TEXT,
    "address_line" TEXT,
    "locality" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "postcode" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'GB',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "service_areas" TEXT[],
    "service_radius_miles" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_products" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "price_pence" INTEGER,
    "unit" TEXT,
    "keywords" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_subscriptions" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "flw_plan_id" TEXT,
    "flw_subscription_id" TEXT,
    "flw_tx_ref" TEXT,
    "flw_customer_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "plan" TEXT NOT NULL DEFAULT 'dealer_monthly',
    "base_price_cents" INTEGER NOT NULL DEFAULT 2900,
    "base_currency" TEXT NOT NULL DEFAULT 'usd',
    "billing_interval" TEXT NOT NULL DEFAULT 'month',
    "presentment_amount_cents" INTEGER,
    "presentment_currency" TEXT,
    "customer_country" TEXT,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_search_profiles" (
    "dealer_id" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "localities" TEXT[],
    "categories_norm" TEXT[],
    "products_norm" TEXT[],
    "cuisines_norm" TEXT[],
    "primary_lat" DOUBLE PRECISION,
    "primary_lng" DOUBLE PRECISION,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "featured_eligible" BOOLEAN NOT NULL DEFAULT false,
    "listing_status" TEXT NOT NULL DEFAULT 'draft',
    "subscription_active" BOOLEAN NOT NULL DEFAULT false,
    "last_built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_search_profiles_pkey" PRIMARY KEY ("dealer_id")
);

-- CreateTable
CREATE TABLE "dealer_events" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "locality" TEXT,
    "query" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_reports" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "reporter_user_id" TEXT,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "dealer_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealers_slug_key" ON "dealers"("slug");

-- CreateIndex
CREATE INDEX "dealers_owner_user_id_idx" ON "dealers"("owner_user_id");

-- CreateIndex
CREATE INDEX "dealers_listing_status_idx" ON "dealers"("listing_status");

-- CreateIndex
CREATE INDEX "dealer_locations_dealer_id_idx" ON "dealer_locations"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_locations_locality_idx" ON "dealer_locations"("locality");

-- CreateIndex
CREATE INDEX "dealer_products_dealer_id_idx" ON "dealer_products"("dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_subscriptions_dealer_id_key" ON "dealer_subscriptions"("dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_subscriptions_stripe_customer_id_key" ON "dealer_subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_subscriptions_stripe_subscription_id_key" ON "dealer_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_subscriptions_flw_subscription_id_key" ON "dealer_subscriptions"("flw_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_subscriptions_flw_tx_ref_key" ON "dealer_subscriptions"("flw_tx_ref");

-- CreateIndex
CREATE INDEX "dealer_search_profiles_listing_status_subscription_active_idx" ON "dealer_search_profiles"("listing_status", "subscription_active");

-- CreateIndex
CREATE INDEX "dealer_events_dealer_id_type_occurred_at_idx" ON "dealer_events"("dealer_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "dealer_reports_dealer_id_idx" ON "dealer_reports"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_reports_status_idx" ON "dealer_reports"("status");

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_locations" ADD CONSTRAINT "dealer_locations_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_products" ADD CONSTRAINT "dealer_products_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_subscriptions" ADD CONSTRAINT "dealer_subscriptions_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_search_profiles" ADD CONSTRAINT "dealer_search_profiles_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_events" ADD CONSTRAINT "dealer_events_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_reports" ADD CONSTRAINT "dealer_reports_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_reports" ADD CONSTRAINT "dealer_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
