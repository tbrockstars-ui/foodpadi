import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';
import { AddAvoidedIngredientDto } from './dto/add-avoided-ingredient.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  listPreferences(userId: string) {
    return this.prisma.foodPreference.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  addPreference(userId: string, dto: UpsertPreferenceDto) {
    return this.prisma.foodPreference.create({ data: { userId, ...dto } });
  }

  // "Forget that I like this" (spec §9) — a real delete, not a hide flag on read paths.
  async deletePreference(userId: string, preferenceId: string) {
    const pref = await this.prisma.foodPreference.findUnique({ where: { id: preferenceId } });
    if (!pref || pref.deletedAt) {
      throw new NotFoundException('Preference not found.');
    }
    if (pref.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.foodPreference.update({
      where: { id: preferenceId },
      data: { deletedAt: new Date() },
    });
  }

  listAvoidedIngredients(userId: string) {
    return this.prisma.avoidedIngredient.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  addAvoidedIngredient(userId: string, dto: AddAvoidedIngredientDto) {
    return this.prisma.avoidedIngredient.create({ data: { userId, ...dto } });
  }

  async removeAvoidedIngredient(userId: string, avoidedIngredientId: string) {
    const item = await this.prisma.avoidedIngredient.findUnique({
      where: { id: avoidedIngredientId },
    });
    if (!item || item.deletedAt) {
      throw new NotFoundException('Avoided ingredient not found.');
    }
    if (item.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.avoidedIngredient.update({
      where: { id: avoidedIngredientId },
      data: { deletedAt: new Date() },
    });
  }
}
