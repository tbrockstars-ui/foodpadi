import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const DEFAULT_PAGE_SIZE = 25;

function toSummary(user: {
  id: string;
  email: string;
  createdAt: Date;
  deletedAt: Date | null;
  profile: { displayName: string | null; onboardingCompletedAt: Date | null; disclaimerAcknowledgedAt: Date | null } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? null,
    createdAt: user.createdAt.toISOString(),
    onboardingCompletedAt: user.profile?.onboardingCompletedAt?.toISOString() ?? null,
    disclaimerAcknowledgedAt: user.profile?.disclaimerAcknowledgedAt?.toISOString() ?? null,
    suspended: user.deletedAt !== null,
    suspendedAt: user.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = query.search
      ? { email: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(toSummary),
      page,
      pageSize,
      total,
    };
  }

  async detail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [goals, preferences, avoidedIngredients, recipeCount, mealPlanCount, pantryItemCount, shoppingListCount] =
      await Promise.all([
        this.prisma.foodGoal.findMany({ where: { userId, isActive: true } }),
        this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null } }),
        this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
        this.prisma.recipe.count({ where: { createdByUserId: userId, deletedAt: null } }),
        this.prisma.mealPlan.count({ where: { userId, deletedAt: null } }),
        this.prisma.pantryItem.count({ where: { userId, deletedAt: null } }),
        this.prisma.shoppingList.count({ where: { userId } }),
      ]);

    return {
      ...toSummary(user),
      authProvider: user.authProvider,
      goals: goals.map((g) => ({ id: g.id, goalType: g.goalType, isPrimary: g.isPrimary, note: g.note })),
      preferences: preferences.map((p) => ({
        id: p.id,
        cuisine: p.cuisine,
        likedMeal: p.likedMeal,
        dislikedIngredient: p.dislikedIngredient,
      })),
      avoidedIngredients: avoidedIngredients.map((a) => ({ id: a.id, ingredientName: a.ingredientName })),
      counts: {
        recipes: recipeCount,
        mealPlans: mealPlanCount,
        pantryItems: pantryItemCount,
        shoppingLists: shoppingListCount,
      },
    };
  }

  /**
   * Soft-disable — sets deletedAt (previously unused for User; self-deletion
   * is a real hard delete, see UsersService.deleteAccount) and revokes every
   * refresh token so the block takes effect immediately rather than waiting
   * out the ~15min access-token TTL. AuthService.login/refresh both check
   * deletedAt so a suspended account can't re-authenticate either.
   */
  async suspend(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (user.deletedAt) {
      throw new ConflictException('User is already suspended.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return this.detail(userId);
  }

  async reactivate(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (!user.deletedAt) {
      throw new ConflictException('User is not suspended.');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
    return this.detail(userId);
  }

  /** Real, hard deletion — same semantics as the user's own self-service
   * delete (UsersService.deleteAccount), triggered by staff instead (e.g. a
   * support request). Cascades via Prisma's onDelete: Cascade. */
  async delete(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
