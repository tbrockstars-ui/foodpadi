import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      onboardingCompletedAt: user.profile?.onboardingCompletedAt?.toISOString() ?? null,
      disclaimerAcknowledgedAt: user.profile?.disclaimerAcknowledgedAt?.toISOString() ?? null,
    };
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
