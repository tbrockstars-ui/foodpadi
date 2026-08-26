-- CreateTable
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pantry_items_user_id_idx" ON "pantry_items"("user_id");

-- AddForeignKey
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
