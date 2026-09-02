import { ReferralsService } from './referrals.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReferralsService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    referral: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    referralMilestone: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let service: ReferralsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      referral: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      referralMilestone: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new ReferralsService(prisma as unknown as PrismaService);
  });

  describe('getOrCreateCode', () => {
    it('returns the existing code without minting a new one', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: 'K7RPXQ2' });

      const code = await service.getOrCreateCode('u1');

      expect(code).toBe('K7RPXQ2');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('mints and persists a code when the user has none', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: null });
      prisma.user.update.mockResolvedValue({});

      const code = await service.getOrCreateCode('u1');

      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{7}$/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { referralCode: code },
      });
    });

    it('falls back to a concurrently-created code when the write collides', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ referralCode: null })
        .mockResolvedValueOnce({ referralCode: 'RACE99X' });
      prisma.user.update.mockRejectedValueOnce(new Error('Unique constraint failed'));

      const code = await service.getOrCreateCode('u1');

      expect(code).toBe('RACE99X');
    });
  });

  describe('attributeOnRegister', () => {
    it('creates a pending referral and a friend-side welcome badge for a valid code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'referrer1', deletedAt: null });
      prisma.referral.create.mockResolvedValue({});

      const result = await service.attributeOnRegister({ referredUserId: 'newbie', code: ' k7rpxq2 ' });

      expect(result).toEqual({ attributed: true });
      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerUserId: 'referrer1',
          referredUserId: 'newbie',
          codeUsed: 'K7RPXQ2',
          signupIpHash: null,
        },
      });
      expect(prisma.referralMilestone.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'newbie', kind: 'joined_via_friend', tier: 0, label: 'Joined via a friend' }],
        skipDuplicates: true,
      });
    });

    it('hashes the signup IP rather than storing it raw', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'referrer1', deletedAt: null });
      prisma.referral.create.mockResolvedValue({});

      await service.attributeOnRegister({ referredUserId: 'newbie', code: 'K7RPXQ2', signupIp: '203.0.113.7' });

      const { signupIpHash } = prisma.referral.create.mock.calls[0][0].data;
      expect(signupIpHash).toMatch(/^[a-f0-9]{64}$/);
      expect(signupIpHash).not.toContain('203.0.113.7');
    });

    it('rejects a self-referral', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'sameUser', deletedAt: null });

      const result = await service.attributeOnRegister({ referredUserId: 'sameUser', code: 'K7RPXQ2' });

      expect(result).toEqual({ attributed: false });
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('ignores an unknown code', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.attributeOnRegister({ referredUserId: 'newbie', code: 'NOPE123' });

      expect(result).toEqual({ attributed: false });
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('ignores a referrer whose account is soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'referrer1', deletedAt: new Date() });

      const result = await service.attributeOnRegister({ referredUserId: 'newbie', code: 'K7RPXQ2' });

      expect(result).toEqual({ attributed: false });
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('swallows a duplicate-referral write and reports not attributed', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'referrer1', deletedAt: null });
      prisma.referral.create.mockRejectedValue(new Error('Unique constraint failed on referred_user_id'));

      const result = await service.attributeOnRegister({ referredUserId: 'newbie', code: 'K7RPXQ2' });

      expect(result).toEqual({ attributed: false });
    });
  });

  describe('markQualifiedIfPending', () => {
    it('transitions a pending referral to qualified and tops up referrer badges', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'r1', referrerUserId: 'referrer1', status: 'pending' });
      prisma.referral.count.mockResolvedValue(3); // referrer now has 3 qualified

      const result = await service.markQualifiedIfPending('newbie');

      expect(result).toEqual({ transitioned: true });
      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'qualified', qualifiedAt: expect.any(Date) },
      });
      // Crossed the 1 and 3 thresholds -> both tiers inserted (skipDuplicates
      // makes the already-earned one a no-op).
      expect(prisma.referralMilestone.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'referrer1', kind: 'referrer_tier', tier: 1, label: 'First Invite' },
          { userId: 'referrer1', kind: 'referrer_tier', tier: 3, label: 'Food Explorer' },
        ],
        skipDuplicates: true,
      });
    });

    it('is a no-op when there is no referral for the user', async () => {
      prisma.referral.findUnique.mockResolvedValue(null);

      expect(await service.markQualifiedIfPending('someone')).toEqual({ transitioned: false });
      expect(prisma.referral.update).not.toHaveBeenCalled();
    });

    it('is a no-op when the referral is already qualified', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'r1', referrerUserId: 'x', status: 'qualified' });

      expect(await service.markQualifiedIfPending('someone')).toEqual({ transitioned: false });
      expect(prisma.referral.update).not.toHaveBeenCalled();
    });

    it('never throws, even if the update fails', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'r1', referrerUserId: 'x', status: 'pending' });
      prisma.referral.update.mockRejectedValue(new Error('db down'));

      expect(await service.markQualifiedIfPending('someone')).toEqual({ transitioned: false });
    });
  });

  describe('getSummary', () => {
    it('returns counts, tier/next-tier progress, unseen badges, a link, and masked handles', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: 'K7RPXQ2' });
      prisma.referral.count
        .mockResolvedValueOnce(4) // joined
        .mockResolvedValueOnce(3); // qualified
      prisma.referral.findMany.mockResolvedValue([
        { status: 'qualified', createdAt: new Date('2026-09-01T10:00:00Z'), referred: { email: 'jane@gmail.com' } },
      ]);
      prisma.referralMilestone.findMany.mockResolvedValue([
        { kind: 'referrer_tier', tier: 3, label: 'Food Explorer', reachedAt: new Date(), seenAt: null },
      ]);

      const summary = await service.getSummary('u1');

      expect(summary.link).toContain('/?ref=K7RPXQ2');
      expect(summary.counts).toEqual({ joined: 4, qualified: 3 });
      expect(summary.tier).toEqual({ threshold: 3, label: 'Food Explorer', icon: '🧭' });
      expect(summary.nextTier).toEqual({ threshold: 5, label: 'Super Connector', icon: '⚡', remaining: 2 });
      expect(summary.unseen).toEqual([{ kind: 'referrer_tier', label: 'Food Explorer', icon: '🧭' }]);
      expect(summary.recent[0]).toEqual({
        maskedHandle: 'j•••@gmail.com',
        status: 'qualified',
        createdAt: '2026-09-01T10:00:00.000Z',
      });
    });

    it('has no tier and a first-tier target before any qualified referral', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: 'AAAA111' });
      prisma.referral.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      const summary = await service.getSummary('u1');

      expect(summary.tier).toBeNull();
      expect(summary.nextTier).toEqual({ threshold: 1, label: 'First Invite', icon: '🌱', remaining: 1 });
    });
  });

  describe('received status', () => {
    it('reports invitedByFriend + unseenWelcome from the welcome badge', async () => {
      prisma.referralMilestone.findUnique.mockResolvedValue({ seenAt: null });

      expect(await service.getReceivedStatus('u1')).toEqual({ invitedByFriend: true, unseenWelcome: true });
    });

    it('reports not-invited when there is no welcome badge', async () => {
      prisma.referralMilestone.findUnique.mockResolvedValue(null);

      expect(await service.getReceivedStatus('u1')).toEqual({ invitedByFriend: false, unseenWelcome: false });
    });
  });
});
