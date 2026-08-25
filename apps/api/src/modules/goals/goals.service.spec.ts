import { GoalsService } from './goals.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GoalsService', () => {
  let prisma: { foodGoal: { create: jest.Mock; findFirst: jest.Mock } };
  let service: GoalsService;

  beforeEach(() => {
    prisma = {
      foodGoal: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new GoalsService(prisma as unknown as PrismaService);
  });

  it('creates a new goal row and returns the current (latest) goal', async () => {
    prisma.foodGoal.findFirst.mockResolvedValue({ id: '1', userId: 'u1', goalType: 'reduce_waste' });

    const result = await service.setGoal('u1', 'reduce_waste');

    expect(prisma.foodGoal.create).toHaveBeenCalledWith({
      data: { userId: 'u1', goalType: 'reduce_waste' },
    });
    expect(result?.goalType).toBe('reduce_waste');
  });

  it('reads the most recently created goal, not just any goal', async () => {
    await service.getCurrentGoal('u1');
    expect(prisma.foodGoal.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
