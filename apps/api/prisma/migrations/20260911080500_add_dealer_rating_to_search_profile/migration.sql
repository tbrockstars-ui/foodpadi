-- AlterTable
ALTER TABLE "dealer_search_profiles" ADD COLUMN     "rating_average" DOUBLE PRECISION,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;
