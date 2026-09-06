import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PatternService } from '../companion/pattern.service';

function buildService() {
  const prisma: any = {
    foodFeedback: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'f1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'f1', ...data })),
    },
  };
  const analytics = { track: jest.fn() };
  const patterns = { recompute: jest.fn().mockResolvedValue(undefined) };
  const service = new FeedbackService(
    prisma as unknown as PrismaService,
    analytics as unknown as AnalyticsService,
    patterns as unknown as PatternService,
  );
  return { service, prisma, analytics, patterns };
}

describe('FeedbackService.create', () => {
  it('persists the row, tracks analytics, and triggers a pattern recompute', async () => {
    const { service, prisma, analytics, patterns } = buildService();

    const result = await service.create('u1', {
      entityType: 'RECIPE',
      entityId: 'r1',
      context: 'COOK',
      rating: 5,
      tags: ['loved_it', 'would_make_again'],
    });

    expect(result).toMatchObject({ userId: 'u1', entityType: 'RECIPE', entityId: 'r1', rating: 5 });
    expect(prisma.foodFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', entityType: 'RECIPE', entityId: 'r1', rating: 5 }),
    });
    expect(analytics.track).toHaveBeenCalledWith(
      'feedback_submitted',
      { userId: 'u1' },
      expect.objectContaining({ entityType: 'RECIPE', context: 'COOK', rating: 5 }),
    );
    // Fire-and-forget — awaited here only because the mock resolves synchronously.
    await Promise.resolve();
    expect(patterns.recompute).toHaveBeenCalledWith('u1');
  });

  it('defaults tags to an empty array when none are given', async () => {
    const { service, prisma } = buildService();
    await service.create('u1', { entityType: 'PLAN', entityId: 'p1', context: 'PLAN', rating: 4 });
    expect(prisma.foodFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tags: [] }),
    });
  });

  it('never fails the submission if the pattern recompute throws', async () => {
    const { service, patterns } = buildService();
    patterns.recompute.mockRejectedValue(new Error('boom'));
    await expect(
      service.create('u1', { entityType: 'RECIPE', entityId: 'r1', context: 'COOK', rating: 3 }),
    ).resolves.toBeDefined();
  });
});

describe('FeedbackService ownership', () => {
  it('rejects updating feedback that does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.foodFeedback.findUnique.mockResolvedValue(null);
    await expect(service.update('u1', 'missing', { rating: 2 })).rejects.toThrow(NotFoundException);
  });

  it("rejects updating someone else's feedback", async () => {
    const { service, prisma } = buildService();
    prisma.foodFeedback.findUnique.mockResolvedValue({ id: 'f1', userId: 'someone-else', deletedAt: null });
    await expect(service.update('u1', 'f1', { rating: 2 })).rejects.toThrow(ForbiddenException);
  });

  it('rejects deleting a soft-deleted row', async () => {
    const { service, prisma } = buildService();
    prisma.foodFeedback.findUnique.mockResolvedValue({ id: 'f1', userId: 'u1', deletedAt: new Date() });
    await expect(service.remove('u1', 'f1')).rejects.toThrow(NotFoundException);
  });

  it('allows the owner to update their own feedback', async () => {
    const { service, prisma } = buildService();
    prisma.foodFeedback.findUnique.mockResolvedValue({ id: 'f1', userId: 'u1', deletedAt: null, rating: 3 });
    const updated = await service.update('u1', 'f1', { rating: 5 });
    expect(updated).toMatchObject({ rating: 5 });
  });

  it('soft-deletes rather than hard-deleting', async () => {
    const { service, prisma } = buildService();
    prisma.foodFeedback.findUnique.mockResolvedValue({ id: 'f1', userId: 'u1', deletedAt: null });
    await service.remove('u1', 'f1');
    expect(prisma.foodFeedback.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('FeedbackService.list', () => {
  it('always scopes to the caller, optionally filtered by entity', async () => {
    const { service, prisma } = buildService();
    await service.list('u1', 'RECIPE', 'r1');
    expect(prisma.foodFeedback.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null, entityType: 'RECIPE', entityId: 'r1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
