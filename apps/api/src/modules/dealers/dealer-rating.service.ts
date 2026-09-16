import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEALER_RATING_MAX,
  DEALER_RATING_MIN,
  type DealerRatingView,
  type DealerRatingsResponse,
  type SubmitDealerRatingRequest,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';

const PAGE_SIZE = 15;
const COMMENT_MAX_LENGTH = 600;

/**
 * Post-visit customer ratings (user instruction 2026-09-11). Deliberately
 * narrow — one star rating (1-5) + an optional short comment per customer per
 * dealer, editable by the rater, moderatable by admin. NOT the review/social
 * network the original brief ruled out of MVP (§41/§78): no likes, no
 * followers, no comment threads, and a rater's identity is never exposed to
 * anyone (brief §42) — every entry other than the caller's own is shown with
 * no name attached at all.
 *
 * `Dealer.ratingAverage/ratingCount` (and their mirror on
 * `DealerSearchProfile`, used by the ranking engine) are recomputed here on
 * every write — the only writer, same "one place owns the denormalisation"
 * shape as DealerSearchProfileService.rebuild.
 */
@Injectable()
export class DealerRatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchProfile: DealerSearchProfileService,
  ) {}

  // --------------------------------------------------------------------------
  // Customer-facing
  // --------------------------------------------------------------------------

  async submit(slug: string, userId: string, dto: SubmitDealerRatingRequest): Promise<DealerRatingsResponse> {
    const dealer = await this.dealerBySlug(slug);
    const rating = Math.round(dto.rating);
    if (!Number.isFinite(rating) || rating < DEALER_RATING_MIN || rating > DEALER_RATING_MAX) {
      throw new BadRequestException(`Rating must be an integer between ${DEALER_RATING_MIN} and ${DEALER_RATING_MAX}.`);
    }
    const comment = dto.comment?.trim().slice(0, COMMENT_MAX_LENGTH) || null;

    await this.prisma.dealerRating.upsert({
      where: { dealerId_userId: { dealerId: dealer.id, userId } },
      create: { dealerId: dealer.id, userId, rating, comment },
      // Re-rating updates in place and un-hides it — a customer correcting
      // their own rating shouldn't stay suppressed by an earlier admin action
      // taken against the old value.
      update: { rating, comment, hidden: false, hiddenAt: null, hiddenBy: null },
    });

    await this.recomputeAggregate(dealer.id);
    return this.list(slug, 1, userId);
  }

  async removeMine(slug: string, userId: string): Promise<DealerRatingsResponse> {
    const dealer = await this.dealerBySlug(slug);
    await this.prisma.dealerRating
      .delete({ where: { dealerId_userId: { dealerId: dealer.id, userId } } })
      .catch(() => undefined); // already absent — deleting is idempotent
    await this.recomputeAggregate(dealer.id);
    return this.list(slug, 1, userId);
  }

  async getMine(slug: string, userId: string): Promise<{ rating: number; comment: string | null } | null> {
    const dealer = await this.dealerBySlug(slug);
    const row = await this.prisma.dealerRating.findUnique({
      where: { dealerId_userId: { dealerId: dealer.id, userId } },
    });
    return row ? { rating: row.rating, comment: row.comment } : null;
  }

  async list(slug: string, page: number, callerUserId: string | null): Promise<DealerRatingsResponse> {
    const dealer = await this.dealerBySlug(slug);
    const p = Math.max(1, page);
    const [rows, count] = await Promise.all([
      this.prisma.dealerRating.findMany({
        where: { dealerId: dealer.id, hidden: false },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.dealerRating.count({ where: { dealerId: dealer.id, hidden: false } }),
    ]);

    const ratings: DealerRatingView[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isMine: r.userId === callerUserId,
    }));

    return {
      average: dealer.ratingAverage,
      count,
      ratings,
      page: p,
      pageSize: PAGE_SIZE,
      hasMore: count > p * PAGE_SIZE,
    };
  }

  // --------------------------------------------------------------------------
  // Admin moderation (brief §39/§40)
  // --------------------------------------------------------------------------

  async listForAdmin(dealerId: string) {
    const rows = await this.prisma.dealerRating.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      hidden: r.hidden,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async setHidden(dealerId: string, ratingId: string, hidden: boolean): Promise<void> {
    const row = await this.prisma.dealerRating.findUnique({ where: { id: ratingId } });
    if (!row || row.dealerId !== dealerId) {
      throw new NotFoundException('Rating not found for this dealer.');
    }
    await this.prisma.dealerRating.update({
      where: { id: ratingId },
      data: hidden
        ? { hidden: true, hiddenAt: new Date(), hiddenBy: null }
        : { hidden: false, hiddenAt: null, hiddenBy: null },
    });
    await this.recomputeAggregate(dealerId);
  }

  // --------------------------------------------------------------------------

  private async dealerBySlug(slug: string) {
    const dealer = await this.prisma.dealer.findUnique({ where: { slug } });
    if (!dealer || dealer.deletedAt) {
      throw new NotFoundException({ message: 'This dealer is no longer listed on FoodPadi.', code: 'not_listed' });
    }
    return dealer;
  }

  private async recomputeAggregate(dealerId: string): Promise<void> {
    const agg = await this.prisma.dealerRating.aggregate({
      where: { dealerId, hidden: false },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const average = agg._count.rating > 0 ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null;
    await this.prisma.dealer.update({
      where: { id: dealerId },
      data: { ratingAverage: average, ratingCount: agg._count.rating },
    });
    // Keep the ranking-facing mirror in DealerSearchProfile in step immediately
    // — a rating shouldn't wait for an unrelated portal write to take effect.
    await this.searchProfile.rebuild(dealerId);
  }
}
