-- AlterTable: in-app Guest/Trial/Paid trial fields
ALTER TABLE "user_profiles"
  ADD COLUMN "trial_started_at" TIMESTAMP(3),
  ADD COLUMN "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN "trial_ai_used_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: admin-tunable in-app trial knobs
ALTER TABLE "billing_config"
  ADD COLUMN "appTrialDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "trialAiLimit" INTEGER NOT NULL DEFAULT 20;

-- Data: give every existing registered account a one-time fresh 7-day trial so
-- no current user drops straight to the GUEST entitlement when this ships.
-- New signups get their trial set explicitly by AuthService.
UPDATE "user_profiles"
SET "trial_started_at" = now(),
    "trial_ends_at" = now() + interval '7 days'
WHERE "trial_ends_at" IS NULL;
