import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PatternService } from '../companion/pattern.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

/**
 * Explicit star-rating feedback (Feedback & Rating brief) — after eating,
 * cooking, or a plan's period ending. Feeds PatternService's
 * recipe/cuisine/plan-satisfaction detectors (see pattern.service.ts) so a
 * rating becomes a real Memory signal, not just a stored number nobody
 * reads. Never touches avoided_ingredients — that stays the only hard
 * exclusion; feedback only ever adjusts soft ranking.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly patterns: PatternService,
  ) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const feedback = await this.prisma.foodFeedback.create({
      data: {
        userId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        context: dto.context,
        rating: dto.rating,
        tags: dto.tags ?? [],
        comment: dto.comment,
      },
    });

    await this.analytics.track('feedback_submitted', { userId }, {
      entityType: dto.entityType,
      context: dto.context,
      rating: dto.rating,
      tagCount: dto.tags?.length ?? 0,
    });

    this.recomputePatterns(userId);
    return feedback;
  }

  list(userId: string, entityType?: string, entityId?: string) {
    return this.prisma.foodFeedback.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateFeedbackDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.foodFeedback.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
      },
    });
    this.recomputePatterns(userId);
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.foodFeedback.update({ where: { id }, data: { deletedAt: new Date() } });
    this.recomputePatterns(userId);
  }

  private async findOwned(userId: string, id: string) {
    const row = await this.prisma.foodFeedback.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Feedback not found.');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException();
    }
    return row;
  }

  // Fire-and-forget, same precedent as AnalyticsService's referral-check and
  // ClaudeService's provider-failure fallback: a scoring bug must never fail
  // the user's feedback submission.
  private recomputePatterns(userId: string): void {
    this.patterns.recompute(userId).catch((err) => {
      this.logger.warn(`Pattern recompute after feedback failed: ${(err as Error).message}`);
    });
  }
}
