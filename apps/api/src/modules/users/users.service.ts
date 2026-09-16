import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidAvatarId } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { normaliseCountryCode } from '../../common/country.util';
import { EntitlementService } from '../billing/entitlement.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const entitlement = await this.entitlements.getUserEntitlement(userId);
    return {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      countryCode: user.profile?.countryCode ?? null,
      onboardingCompletedAt: user.profile?.onboardingCompletedAt?.toISOString() ?? null,
      disclaimerAcknowledgedAt: user.profile?.disclaimerAcknowledgedAt?.toISOString() ?? null,
      entitlement,
      trialEndsAt: user.profile?.trialEndsAt?.toISOString() ?? null,
      birthMonth: user.profile?.birthMonth ?? null,
      avatarId: user.profile?.avatarId ?? null,
    };
  }

  /** Partial profile update — country of residence, display name, and the
   *  birth-month avatar picker (user instruction 2026-09-11). */
  async updateProfile(
    userId: string,
    patch: { countryCode?: string; displayName?: string; birthMonth?: number | null; avatarId?: string | null },
  ) {
    const data: {
      countryCode?: string | null;
      displayName?: string;
      birthMonth?: number | null;
      avatarId?: string | null;
    } = {};
    if (patch.countryCode !== undefined) {
      const code = normaliseCountryCode(patch.countryCode);
      if (patch.countryCode && !code) {
        throw new BadRequestException('countryCode must be a 2-letter ISO country code.');
      }
      data.countryCode = code;
    }
    if (patch.displayName !== undefined) {
      data.displayName = patch.displayName.trim();
    }
    if (patch.birthMonth !== undefined) {
      data.birthMonth = patch.birthMonth;
    }
    if (patch.avatarId !== undefined) {
      if (patch.avatarId !== null && !isValidAvatarId(patch.avatarId)) {
        throw new BadRequestException('avatarId is not a recognised avatar.');
      }
      data.avatarId = patch.avatarId;
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.userProfile.update({ where: { userId }, data });
    }
    return this.getProfile(userId);
  }

  async acknowledgeDisclaimer(userId: string) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { disclaimerAcknowledgedAt: new Date() },
    });
    return this.getProfile(userId);
  }

  async completeOnboarding(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile?.disclaimerAcknowledgedAt) {
      throw new NotFoundException('Disclaimer must be acknowledged before completing onboarding.');
    }
    await this.prisma.userProfile.update({
      where: { userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return this.getProfile(userId);
  }

  /**
   * Full data export (spec §9, §26). Returns everything the user's food
   * profile currently holds — deliberately not paginated/summarised, since
   * this endpoint's whole purpose is completeness for a portability request.
   */
  async exportData(userId: string) {
    const [user, goals, preferences, avoidedIngredients, memory] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
      this.prisma.foodGoal.findMany({ where: { userId } }),
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.aiMemory.findMany({ where: { userId, deletedAt: null } }),
    ]);

    return {
      account: { id: user?.id, email: user?.email, createdAt: user?.createdAt },
      profile: user?.profile,
      foodGoals: goals,
      foodPreferences: preferences,
      avoidedIngredients,
      aiMemory: memory,
    };
  }

  /**
   * Real, hard account deletion (spec §25 "account deletion" — not a soft
   * deactivate). Cascades remove owned rows via Prisma's onDelete: Cascade.
   */
  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
