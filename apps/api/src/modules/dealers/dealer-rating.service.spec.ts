import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DealerRatingService } from './dealer-rating.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { PrismaService } from '../../prisma/prisma.service';

function build() {
  const dealer: any = { id: 'd1', slug: 'mamas-foods', deletedAt: null, ratingAverage: null, ratingCount: 0 };
  const ratings: any[] = [];
  let seq = 1;

  const recompute = () => {
    const visible = ratings.filter((r) => !r.hidden);
    dealer.ratingCount = visible.length;
    dealer.ratingAverage =
      visible.length > 0
        ? Math.round((visible.reduce((s, r) => s + r.rating, 0) / visible.length) * 10) / 10
        : null;
  };

  const prisma: any = {
    dealer: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.slug ? (dealer.slug === where.slug ? dealer : null) : null,
      ),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(dealer, data);
        return dealer;
      }),
    },
    dealerRating: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = ratings.find(
          (r) => r.dealerId === where.dealerId_userId.dealerId && r.userId === where.dealerId_userId.userId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const row = { id: `r${seq++}`, hidden: false, createdAt: new Date(), updatedAt: new Date(), ...create };
        ratings.push(row);
        return row;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const i = ratings.findIndex(
          (r) => r.dealerId === where.dealerId_userId.dealerId && r.userId === where.dealerId_userId.userId,
        );
        if (i < 0) throw new Error('not found');
        const [row] = ratings.splice(i, 1);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return ratings.find((r) => r.id === where.id) ?? null;
        return (
          ratings.find(
            (r) => r.dealerId === where.dealerId_userId.dealerId && r.userId === where.dealerId_userId.userId,
          ) ?? null
        );
      }),
      findMany: jest.fn(async ({ where, skip = 0, take }: any) => {
        let rows = ratings.filter((r) => r.dealerId === where.dealerId);
        if (where.hidden !== undefined) rows = rows.filter((r) => r.hidden === where.hidden);
        rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return take ? rows.slice(skip, skip + take) : rows.slice(skip);
      }),
      count: jest.fn(async ({ where }: any) => {
        let rows = ratings.filter((r) => r.dealerId === where.dealerId);
        if (where.hidden !== undefined) rows = rows.filter((r) => r.hidden === where.hidden);
        return rows.length;
      }),
      aggregate: jest.fn(async ({ where }: any) => {
        const rows = ratings.filter((r) => r.dealerId === where.dealerId && r.hidden === where.hidden);
        const count = rows.length;
        const avg = count > 0 ? rows.reduce((s, r) => s + r.rating, 0) / count : null;
        return { _avg: { rating: avg }, _count: { rating: count } };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = ratings.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
  };

  const searchProfile = { rebuild: jest.fn().mockResolvedValue(undefined) } as unknown as DealerSearchProfileService;
  const svc = new DealerRatingService(prisma as unknown as PrismaService, searchProfile);
  return { svc, prisma, dealer, ratings, searchProfile, recompute };
}

describe('DealerRatingService.submit', () => {
  it('creates a rating and recomputes the dealer aggregate + search index', async () => {
    const { svc, dealer, searchProfile } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5, comment: 'Great jollof!' });
    expect(dealer.ratingAverage).toBe(5);
    expect(dealer.ratingCount).toBe(1);
    expect(searchProfile.rebuild).toHaveBeenCalledWith('d1');
  });

  it('re-rating the same dealer updates in place — one rating per customer per dealer', async () => {
    const { svc, dealer, ratings } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 2 });
    await svc.submit('mamas-foods', 'u1', { rating: 4 });
    expect(ratings).toHaveLength(1);
    expect(ratings[0].rating).toBe(4);
    expect(dealer.ratingAverage).toBe(4);
  });

  it('rejects an out-of-range rating', async () => {
    const { svc } = build();
    await expect(svc.submit('mamas-foods', 'u1', { rating: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.submit('mamas-foods', 'u1', { rating: 6 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims and caps an overlong comment', async () => {
    const { svc, ratings } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 3, comment: '  x'.repeat(300) + '  ' });
    expect(ratings[0].comment!.length).toBeLessThanOrEqual(600);
  });

  it('unknown dealer slug → 404', async () => {
    const { svc } = build();
    await expect(svc.submit('nope', 'u1', { rating: 5 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the average recomputes correctly across several ratings', async () => {
    const { svc, dealer } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5 });
    await svc.submit('mamas-foods', 'u2', { rating: 3 });
    await svc.submit('mamas-foods', 'u3', { rating: 4 });
    expect(dealer.ratingCount).toBe(3);
    expect(dealer.ratingAverage).toBeCloseTo(4, 1);
  });
});

describe('DealerRatingService.removeMine', () => {
  it('deletes the caller\'s own rating and recomputes the aggregate', async () => {
    const { svc, dealer } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5 });
    await svc.submit('mamas-foods', 'u2', { rating: 1 });
    await svc.removeMine('mamas-foods', 'u1');
    expect(dealer.ratingCount).toBe(1);
    expect(dealer.ratingAverage).toBe(1);
  });

  it('is idempotent when the caller never rated this dealer', async () => {
    const { svc } = build();
    await expect(svc.removeMine('mamas-foods', 'nobody')).resolves.toBeDefined();
  });
});

describe('DealerRatingService.list / getMine', () => {
  it('list marks only the calling user\'s own entry as isMine, and never exposes anyone else\'s identity', async () => {
    const { svc } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5, comment: 'Lovely' });
    await svc.submit('mamas-foods', 'u2', { rating: 2, comment: 'Meh' });
    const asU1 = await svc.list('mamas-foods', 1, 'u1');
    const mine = asU1.ratings.find((r) => r.comment === 'Lovely')!;
    const theirs = asU1.ratings.find((r) => r.comment === 'Meh')!;
    expect(mine.isMine).toBe(true);
    expect(theirs.isMine).toBe(false);
    expect(Object.keys(theirs)).not.toEqual(expect.arrayContaining(['userId', 'authorName', 'email']));
  });

  it('a hidden rating never appears in the public list or the average', async () => {
    const { svc, ratings, dealer } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5 });
    await svc.submit('mamas-foods', 'u2', { rating: 1 });
    await svc.setHidden('d1', ratings[1].id, true);
    const list = await svc.list('mamas-foods', 1, null);
    expect(list.count).toBe(1);
    expect(list.ratings).toHaveLength(1);
    expect(dealer.ratingAverage).toBe(5);
  });

  it('getMine returns null when the caller has not rated', async () => {
    const { svc } = build();
    expect(await svc.getMine('mamas-foods', 'stranger')).toBeNull();
  });
});

describe('DealerRatingService admin moderation', () => {
  it('hides a rating and recomputes the aggregate; unhiding restores it', async () => {
    const { svc, ratings, dealer } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5 });
    await svc.submit('mamas-foods', 'u2', { rating: 1 });
    await svc.setHidden('d1', ratings[1].id, true);
    expect(dealer.ratingAverage).toBe(5);
    await svc.setHidden('d1', ratings[1].id, false);
    expect(dealer.ratingAverage).toBe(3);
  });

  it('rejects a rating id that belongs to a different dealer', async () => {
    const { svc, ratings } = build();
    await svc.submit('mamas-foods', 'u1', { rating: 5 });
    await expect(svc.setHidden('some-other-dealer-id', ratings[0].id, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
