-- CreateTable
CREATE TABLE "food_image_cache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "food_name" TEXT NOT NULL,
    "search_query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "provider" TEXT,
    "image_url" TEXT,
    "thumbnail_url" TEXT,
    "photographer_name" TEXT,
    "photographer_url" TEXT,
    "source_url" TEXT,
    "download_location" TEXT,
    "is_representative" BOOLEAN NOT NULL DEFAULT true,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_image_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_image_cache_key_key" ON "food_image_cache"("key");
