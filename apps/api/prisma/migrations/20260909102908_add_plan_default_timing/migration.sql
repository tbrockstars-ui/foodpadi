-- AlterTable
ALTER TABLE "meal_plan_items" ADD COLUMN     "reminder_offset_minutes" INTEGER;

-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "default_meal_time" TEXT,
ADD COLUMN     "default_reminder_offset_minutes" INTEGER NOT NULL DEFAULT 30;
