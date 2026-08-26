import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FoodGoal } from '@foodpadi/shared';

interface SetGoalsInput {
  goalTypes: FoodGoal[];
  primaryGoalType?: FoodGoal;
  personalGoalNote?: string;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * A user's current goals are the isActive=true rows (up to 3, exactly one
   * isPrimary). Setting a new set deactivates the old active rows and
   * inserts a fresh batch rather than mutating in place, so full history is
   * preserved — mirrors the pre-multiselect "latest wins" read behaviour.
   */
  async setGoals(userId: string, input: SetGoalsInput) {
    const goalTypes = [...new Set(input.goalTypes)];

    if (goalTypes.includes('none') && goalTypes.length > 1) {
      throw new BadRequestException('"No particular goal" cannot be combined with other goals.');
    }

    let primaryGoalType: FoodGoal;
    if (goalTypes.length === 1) {
      primaryGoalType = goalTypes[0];
    } else {
      if (!input.primaryGoalType || !goalTypes.includes(input.primaryGoalType)) {
        throw new BadRequestException('primaryGoalType must be one of the selected goals.');
      }
      primaryGoalType = input.primaryGoalType;
    }

    const personalNote = goalTypes.includes('personal') ? input.personalGoalNote?.trim() || null : null;

    await this.prisma.$transaction([
      this.prisma.foodGoal.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.foodGoal.createMany({
        data: goalTypes.map((goalType) => ({
          userId,
          goalType,
          isPrimary: goalType === primaryGoalType,
          isActive: true,
          note: goalType === 'personal' ? personalNote : null,
        })),
      }),
    ]);

    // Goal IDs only — never the free-text note (spec §17).
    await this.analytics.track(
      'food_goals_completed',
      { userId },
      { goalTypes, primaryGoalType, hasPersonalNote: !!personalNote },
    );

    return this.getGoals(userId);
  }

  async getGoals(userId: string) {
    const goals = await this.prisma.foodGoal.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return { goals: goals.map((g) => ({ goalType: g.goalType, isPrimary: g.isPrimary, note: g.note })) };
  }
}
