-- AlterTable
ALTER TABLE "waitlist_signups" ADD COLUMN     "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketing_consent_at" TIMESTAMP(3),
ADD COLUMN     "marketing_consent_version" TEXT;
