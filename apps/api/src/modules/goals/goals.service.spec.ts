import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

describe('GoalsService', () => {
  let prisma: {
    foodGoal: { updateMany: jest.Mock; createMany: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let analytics: { track: jest.Mock };
  let service: GoalsService;

  beforeEach(() => {
    prisma = {
      foodGoal: {
        updateMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    analytics = { track: jest.fn() };
    service = new GoalsService(prisma as unknown as PrismaService, analytics as unknown as AnalyticsService);
  });

  it('deactivates the old active set and inserts the new one, auto-assigning primary for a single goal', async () => {
    prisma.foodGoal.findMany.mockResolvedValue([
      { goalType: 'reduce_waste', isPrimary: true, note: null },
    ]);

    const result = await service.setGoals('u1', { goalTypes: ['reduce_waste'] });

    expect(prisma.foodGoal.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.foodGoal.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', goalType: 'reduce_waste', isPrimary: true, isActive: true, note: null }],
    });
    expect(result.goals[0].goalType).toBe('reduce_waste');
  });

  it('requires a primaryGoalType that is one of the selected goals when 2+ are selected', async () => {
    await expect(
      service.setGoals('u1', { goalTypes: ['reduce_waste', 'home_cooked'] }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.setGoals('u1', { goalTypes: ['reduce_waste', 'home_cooked'], primaryGoalType: 'personal' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts multiple goals with a valid primary and persists the personal note only on the personal row', async () => {
    await service.setGoals('u1', {
      goalTypes: ['reduce_waste', 'personal'],
      primaryGoalType: 'reduce_waste',
      personalGoalNote: 'Make weekday meals easier',
    });

    expect(prisma.foodGoal.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', goalType: 'reduce_waste', isPrimary: true, isActive: true, note: null },
        {
          userId: 'u1',
          goalType: 'personal',
          isPrimary: false,
          isActive: true,
          note: 'Make weekday meals easier',
        },
      ],
    });
  });

  it('rejects "none" combined with any other goal', async () => {
    await expect(
      service.setGoals('u1', { goalTypes: ['none', 'reduce_waste'], primaryGoalType: 'none' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('tracks food_goals_completed with goal IDs only, never note text', async () => {
    await service.setGoals('u1', { goalTypes: ['personal'], personalGoalNote: 'secret diagnosis' });

    expect(analytics.track).toHaveBeenCalledWith(
      'food_goals_completed',
      { userId: 'u1' },
      { goalTypes: ['personal'], primaryGoalType: 'personal', hasPersonalNote: true },
    );
  });

  it('reads only the active goals for a user', async () => {
    await service.getGoals('u1');
    expect(prisma.foodGoal.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  });
});
