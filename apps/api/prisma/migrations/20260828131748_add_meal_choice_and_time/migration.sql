-- AlterTable
ALTER TABLE "meal_plan_items" ADD COLUMN     "meal_choice" TEXT NOT NULL DEFAULT 'cook',
ADD COLUMN     "planned_time" TEXT;
