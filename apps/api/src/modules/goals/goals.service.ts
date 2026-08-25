import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FoodGoal } from '@foodpadi/shared';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A user has exactly one active goal at a time (§10 is a single-select
   * "What is your food & lifestyle goal?"), so setting a new one replaces
   * rather than appends.
   */
  async setGoal(userId: string, goalType: FoodGoal) {
    await this.prisma.foodGoal.create({ data: { userId, goalType } });
    return this.getCurrentGoal(userId);
  }

  async getCurrentGoal(userId: string) {
    return this.prisma.foodGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
