-- CreateTable
CREATE TABLE "daily_reminder_preferences" (
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weekday_breakfast_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekday_breakfast_time" TEXT,
    "weekday_lunch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekday_lunch_time" TEXT,
    "weekday_dinner_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekday_dinner_time" TEXT,
    "weekday_coffee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekday_coffee_time" TEXT,
    "weekend_breakfast_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekend_breakfast_time" TEXT,
    "weekend_lunch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekend_lunch_time" TEXT,
    "weekend_dinner_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekend_dinner_time" TEXT,
    "weekend_coffee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekend_coffee_time" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reminder_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "daily_reminder_preferences" ADD CONSTRAINT "daily_reminder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
