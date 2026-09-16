-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "rating_average" DOUBLE PRECISION,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "dealer_ratings" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_by" TEXT,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dealer_ratings_dealer_id_hidden_idx" ON "dealer_ratings"("dealer_id", "hidden");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_ratings_dealer_id_user_id_key" ON "dealer_ratings"("dealer_id", "user_id");

-- AddForeignKey
ALTER TABLE "dealer_ratings" ADD CONSTRAINT "dealer_ratings_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_ratings" ADD CONSTRAINT "dealer_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
