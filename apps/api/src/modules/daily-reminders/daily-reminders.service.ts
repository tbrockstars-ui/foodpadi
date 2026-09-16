import { Injectable } from '@nestjs/common';
import type { DailyReminderPreference } from '@prisma/client';
import {
  DAILY_REMINDER_MEAL_TYPES,
  type DailyReminderMealType,
  type DailyReminderPreferencesView,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { UpdateDailyReminderPreferencesDto } from './dto/update-daily-reminder-preferences.dto';

type DayKind = 'weekday' | 'weekend';

// Maps (dayKind, mealType) -> the flat Prisma column names — the one place
// that translation lives, so the nested view <-> flat row mapping below and
// in the DB migration can never silently drift apart.
function columnNames(dayKind: DayKind, mealType: DailyReminderMealType): { enabledCol: string; timeCol: string } {
  const cap = mealType[0].toUpperCase() + mealType.slice(1);
  return { enabledCol: `${dayKind}${cap}Enabled`, timeCol: `${dayKind}${cap}Time` };
}

/**
 * FoodPadi Daily Companion Reminders — user-configured "it's around your
 * usual lunch/coffee time" preferences (docs brief: "Daily Companion
 * Reminders"). Server is the source of truth (brief §23); the client owns
 * actually scheduling/firing the local notification (same architecture Plan
 * Ahead's reminders already use — see apps/web/lib/mealReminders.ts).
 *
 * One row per user, created lazily on first read with every slot off (brief
 * §37 — no assumed routine), mirroring CompanionService's own
 * upsert-on-read pattern for CompanionPreference.
 */
@Injectable()
export class DailyRemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  private upsertRow(userId: string, data: Record<string, unknown> = {}): Promise<DailyReminderPreference> {
    return this.prisma.dailyReminderPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async getPreferences(userId: string): Promise<DailyReminderPreferencesView> {
    const row = await this.upsertRow(userId);
    return toView(row);
  }

  /**
   * Partial update — every provided slot/field is applied, everything else
   * is left exactly as stored (brief §16). Diffs old vs new to fire the
   * handful of analytics events the brief asks for (§48); never lets a
   * tracking failure affect the save itself.
   */
  async updatePreferences(
    userId: string,
    dto: UpdateDailyReminderPreferencesDto,
  ): Promise<DailyReminderPreferencesView> {
    const before = await this.upsertRow(userId);

    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const days: { kind: DayKind; patch?: UpdateDailyReminderPreferencesDto['weekday'] }[] = [
      { kind: 'weekday', patch: dto.weekday },
      { kind: 'weekend', patch: dto.weekend },
    ];
    for (const { kind, patch } of days) {
      if (!patch) continue;
      for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
        const slot = patch[mealType];
        if (!slot) continue;
        const { enabledCol, timeCol } = columnNames(kind, mealType);
        if (slot.enabled !== undefined) data[enabledCol] = slot.enabled;
        if (slot.time !== undefined) data[timeCol] = slot.time;
      }
    }

    const after = Object.keys(data).length > 0 ? await this.upsertRow(userId, data) : before;

    void this.trackChanges(userId, before, after, dto.source);

    return toView(after);
  }

  private async trackChanges(
    userId: string,
    before: DailyReminderPreference,
    after: DailyReminderPreference,
    source: 'onboarding' | 'settings' | undefined,
  ): Promise<void> {
    try {
      if (source === 'onboarding') {
        await this.analytics.track('daily_reminders_setup', { userId });
      }
      for (const kind of ['weekday', 'weekend'] as const) {
        for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
          const { enabledCol, timeCol } = columnNames(kind, mealType);
          const wasEnabled = before[enabledCol as keyof DailyReminderPreference] as boolean;
          const isEnabled = after[enabledCol as keyof DailyReminderPreference] as boolean;
          const metadata = { mealType, dayKind: kind };
          if (!wasEnabled && isEnabled) {
            await this.analytics.track('daily_reminder_enabled', { userId }, metadata);
          } else if (wasEnabled && !isEnabled) {
            await this.analytics.track('daily_reminder_disabled', { userId }, metadata);
          } else if (
            isEnabled &&
            before[timeCol as keyof DailyReminderPreference] !== after[timeCol as keyof DailyReminderPreference]
          ) {
            await this.analytics.track('reminder_time_changed', { userId }, metadata);
          }
        }
      }
    } catch {
      // Analytics must never affect whether the save itself succeeded.
    }
  }
}

function toView(row: DailyReminderPreference): DailyReminderPreferencesView {
  const daySchedule = (kind: DayKind) =>
    Object.fromEntries(
      DAILY_REMINDER_MEAL_TYPES.map((mealType) => {
        const { enabledCol, timeCol } = columnNames(kind, mealType);
        return [
          mealType,
          {
            enabled: row[enabledCol as keyof DailyReminderPreference] as boolean,
            time: (row[timeCol as keyof DailyReminderPreference] as string | null) ?? null,
          },
        ];
      }),
    ) as DailyReminderPreferencesView['weekday'];

  return {
    enabled: row.enabled,
    weekday: daySchedule('weekday'),
    weekend: daySchedule('weekend'),
    updatedAt: row.updatedAt.toISOString(),
  };
}
