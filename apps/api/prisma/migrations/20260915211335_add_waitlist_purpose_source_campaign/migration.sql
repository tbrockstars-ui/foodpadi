-- AlterTable
ALTER TABLE "waitlist_signups" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "source" TEXT;
