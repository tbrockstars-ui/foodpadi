import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  REFERRAL_TIERS,
  type ReferralListItem,
  type ReferralMilestoneNotice,
  type ReferralReceivedStatus,
  type ReferralSummary,
  type ReferralTier,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { generateReferralCode, normaliseReferralCode } from './referral-code.util';

const RECENT_LIMIT = 20;
const CODE_GENERATION_ATTEMPTS = 5;

const REFERRER_TIER_KIND = 'referrer_tier';
const JOINED_KIND = 'joined_via_friend';
const JOINED_LABEL = 'Joined via a friend';
const JOINED_ICON = '🎁';

interface AttributeArgs {
  referredUserId: string;
  /** Raw code as it arrived (from the ?ref= link / register body). */
  code: string;
  /** Raw client IP of the signup, if the caller could determine one. */
  signupIp?: string | null;
}

/**
 * "Feed a Friend" referrals (docs/REFERRAL_PLAN.md).
 *
 * Depends on Prisma only — deliberately no AnalyticsService, so the analytics
 * layer can call into *this* (for the qualification hook) without a circular
 * dependency. Referral analytics events are emitted by the callers instead.
 *
 * Phase 1b rewards are recognition-only (ReferralMilestone badges); the
 * `Referral.status` "rewarded" state stays reserved for a future paid perk.
 */
@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The member's code, minting a collision-checked one on first request. */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (existing?.referralCode) return existing.referralCode;

    for (let attempt = 1; attempt <= CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const code = generateReferralCode();
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch {
        // Either this code is already taken, or a concurrent request just gave
        // this user one. Re-read: if they now have a code, use it; otherwise
        // it was a genuine collision — loop and try a fresh code.
        const current = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { referralCode: true },
        });
        if (current?.referralCode) return current.referralCode;
        this.logger.warn(`Referral code collision (attempt ${attempt}/${CODE_GENERATION_ATTEMPTS})`);
      }
    }
    throw new Error('Could not generate a unique referral code');
  }

  /** Just the share link — the lightweight call for contextual share nudges. */
  async getShareLink(userId: string): Promise<{ link: string }> {
    return { link: this.buildLink(await this.getOrCreateCode(userId)) };
  }

  async getSummary(userId: string): Promise<ReferralSummary> {
    const code = await this.getOrCreateCode(userId);
    const [rows, joined, qualified, unseenRows] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        include: { referred: { select: { email: true } } },
      }),
      this.prisma.referral.count({ where: { referrerUserId: userId } }),
      this.prisma.referral.count({
        where: { referrerUserId: userId, status: { in: ['qualified', 'rewarded'] } },
      }),
      this.prisma.referralMilestone.findMany({
        where: { userId, seenAt: null },
        orderBy: { reachedAt: 'asc' },
      }),
    ]);

    const { tier, nextTier } = resolveTiers(qualified);

    return {
      code,
      link: this.buildLink(code),
      counts: { joined, qualified },
      tier,
      nextTier,
      unseen: unseenRows.map(
        (m): ReferralMilestoneNotice => ({
          kind: m.kind === JOINED_KIND ? 'joined_via_friend' : 'referrer_tier',
          label: m.label,
          icon: iconForMilestone(m.kind, m.tier),
        }),
      ),
      recent: rows.map(toListItem),
    };
  }

  /** Mark every unseen badge for this user as acknowledged (celebration shown). */
  async acknowledgeMilestones(userId: string): Promise<void> {
    await this.prisma.referralMilestone.updateMany({
      where: { userId, seenAt: null },
      data: { seenAt: new Date() },
    });
  }

  /** Friend-side: was this account created via an invite, and is the welcome still unseen? */
  async getReceivedStatus(userId: string): Promise<ReferralReceivedStatus> {
    const welcome = await this.prisma.referralMilestone.findUnique({
      where: { userId_kind_tier: { userId, kind: JOINED_KIND, tier: 0 } },
      select: { seenAt: true },
    });
    return {
      invitedByFriend: welcome !== null,
      unseenWelcome: welcome !== null && welcome.seenAt === null,
    };
  }

  async acknowledgeWelcome(userId: string): Promise<void> {
    await this.prisma.referralMilestone.updateMany({
      where: { userId, kind: JOINED_KIND, seenAt: null },
      data: { seenAt: new Date() },
    });
  }

  /**
   * Called from AuthService immediately after a referred user's account row is
   * created. Best-effort: every failure path is logged and swallowed — a bad
   * or self-referring code must never stop someone from registering. Returns
   * whether a Referral row was actually created.
   */
  async attributeOnRegister({
    referredUserId,
    code,
    signupIp,
  }: AttributeArgs): Promise<{ attributed: boolean }> {
    try {
      const normalised = normaliseReferralCode(code);
      if (!normalised) return { attributed: false };

      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: normalised },
        select: { id: true, deletedAt: true },
      });
      if (!referrer || referrer.deletedAt) {
        this.logger.debug(`Referral code "${normalised}" did not resolve to an active user`);
        return { attributed: false };
      }
      if (referrer.id === referredUserId) {
        this.logger.debug('Ignoring self-referral');
        return { attributed: false };
      }

      await this.prisma.referral.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId,
          codeUsed: normalised,
          signupIpHash: signupIp ? hashIp(signupIp) : null,
        },
      });

      // Friend-side "reward": a one-time welcome badge, celebrated on their
      // next visit. skipDuplicates guards a re-run.
      await this.prisma.referralMilestone.createMany({
        data: [{ userId: referredUserId, kind: JOINED_KIND, tier: 0, label: JOINED_LABEL }],
        skipDuplicates: true,
      });

      return { attributed: true };
    } catch (err) {
      // Most likely the unique constraint on referredUserId (this person was
      // already attributed to someone). Attribution is advisory — carry on.
      this.logger.warn(`attributeOnRegister skipped: ${(err as Error).message}`);
      return { attributed: false };
    }
  }

  /**
   * Flip this user's pending referral (if any) to "qualified", then top up the
   * referrer's tier badges. Cheap: `referredUserId` is unique, so the lookup
   * is a point read that matches nothing for the ~all users who were never
   * referred. Idempotent. Returns whether a transition happened — the seam a
   * future paid reward would hang off.
   */
  async markQualifiedIfPending(referredUserId: string): Promise<{ transitioned: boolean }> {
    try {
      const pending = await this.prisma.referral.findUnique({
        where: { referredUserId },
        select: { id: true, referrerUserId: true, status: true },
      });
      if (!pending || pending.status !== 'pending') return { transitioned: false };

      await this.prisma.referral.update({
        where: { id: pending.id },
        data: { status: 'qualified', qualifiedAt: new Date() },
      });
      await this.syncReferrerMilestones(pending.referrerUserId);
      return { transitioned: true };
    } catch (err) {
      this.logger.warn(`markQualifiedIfPending failed: ${(err as Error).message}`);
      return { transitioned: false };
    }
  }

  /** Insert any recognition tiers this referrer has newly crossed. */
  private async syncReferrerMilestones(referrerUserId: string): Promise<void> {
    const qualified = await this.prisma.referral.count({
      where: { referrerUserId, status: { in: ['qualified', 'rewarded'] } },
    });
    const earned = REFERRAL_TIERS.filter((t) => qualified >= t.threshold);
    if (earned.length === 0) return;

    await this.prisma.referralMilestone.createMany({
      data: earned.map((t) => ({
        userId: referrerUserId,
        kind: REFERRER_TIER_KIND,
        tier: t.threshold,
        label: t.label,
      })),
      skipDuplicates: true,
    });
  }

  private buildLink(code: string): string {
    // WEB_APP_URL is a comma-separated allow-list for CORS (see main.ts); the
    // first entry is the canonical public origin.
    const base = (process.env.WEB_APP_URL ?? 'https://foodpadi.app')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    return `${base}/?ref=${encodeURIComponent(code)}`;
  }
}

function resolveTiers(qualified: number): {
  tier: ReferralTier | null;
  nextTier: (ReferralTier & { remaining: number }) | null;
} {
  const reached = REFERRAL_TIERS.filter((t) => qualified >= t.threshold);
  const tier = reached.length > 0 ? reached[reached.length - 1] : null;
  const upcoming = REFERRAL_TIERS.find((t) => qualified < t.threshold);
  return {
    tier: tier ? { ...tier } : null,
    nextTier: upcoming ? { ...upcoming, remaining: upcoming.threshold - qualified } : null,
  };
}

function iconForMilestone(kind: string, tier: number): string {
  if (kind === JOINED_KIND) return JOINED_ICON;
  return REFERRAL_TIERS.find((t) => t.threshold === tier)?.icon ?? '🎉';
}

function toListItem(row: {
  status: string;
  createdAt: Date;
  referred: { email: string };
}): ReferralListItem {
  return {
    maskedHandle: maskEmail(row.referred.email),
    status: row.status as ReferralListItem['status'],
    createdAt: row.createdAt.toISOString(),
  };
}

/** "jane@gmail.com" -> "j•••@gmail.com". Never expose a referred person's full email. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) return 'a friend';
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}
