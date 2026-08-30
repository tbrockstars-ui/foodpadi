import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ClaudeService } from '../ai/claude.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { demoScenario, demoScenarioForPhoto } from './demo-scan-analyzer';
import { demoFoodContentForPhoto } from './demo-food-content-analyzer';
import { AddPantryItemsDto } from './dto/add-pantry-items.dto';
import { ScanFoodContentDto } from './dto/scan-food-content.dto';
import { ScanPhotoDto } from './dto/scan-photo.dto';
import { FoodContentView, sanitizeFoodContent, sanitizeScannedItems, ScannedItemView } from './scan-validation';

export interface ScanPhotoResult {
  items: ScannedItemView[];
  demo: boolean;
}

export interface ScanFoodContentResult extends FoodContentView {
  demo: boolean;
}

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

@Injectable()
export class ScanService {
  constructor(
    private readonly claude: ClaudeService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Analyses a photo (or an explicit demo scenario) into candidate items —
   * never persisted here. Three paths:
   *  1. dto.demoScenario given — an explicit "Try a sample kitchen" pick,
   *     always served locally regardless of SCAN_DEMO_MODE (no real photo
   *     exists for these, so there's nothing to send to Anthropic anyway).
   *  2. A real photo with SCAN_DEMO_MODE=true — deterministically mapped to
   *     a scenario from the photo's own bytes, never sent to Anthropic.
   *  3. A real photo with SCAN_DEMO_MODE unset/false — the existing
   *     ClaudeService vision path, untouched.
   */
  async scanPhoto(dto: ScanPhotoDto, userId: string): Promise<ScanPhotoResult> {
    const demoModeEnabled = process.env.SCAN_DEMO_MODE === 'true';
    let raw;
    let demo: boolean;

    if (dto.demoScenario) {
      raw = demoScenario(dto.demoScenario);
      demo = true;
    } else {
      if (!dto.imageBase64 || !dto.mediaType) {
        throw new BadRequestException('A photo or a sample kitchen selection is required.');
      }
      if (demoModeEnabled) {
        raw = demoScenarioForPhoto(dto.imageBase64);
        demo = true;
      } else {
        raw = await this.claude.analyzeFoodPhoto(dto.imageBase64, dto.mediaType);
        demo = false;
      }
    }

    const items = sanitizeScannedItems(raw);

    await this.analytics.track('scan_analysis_completed', { userId }, { itemCount: items.length, demo });

    return { items, demo };
  }

  /**
   * "What's in this dish?" — identifies a prepared dish and its likely
   * ingredient composition from one photo, so a customer can see the
   * possible combination of what's in it. Read-only (nothing persisted,
   * unlike scanPhoto above which feeds into addPantryItems) — guest-
   * accessible for the same reason /decide and /local-food-search are.
   */
  async scanFoodContent(dto: ScanFoodContentDto, actor: RequestActor): Promise<ScanFoodContentResult> {
    const demoModeEnabled = process.env.SCAN_DEMO_MODE === 'true';
    const raw = demoModeEnabled
      ? demoFoodContentForPhoto(dto.imageBase64)
      : await this.claude.analyzeFoodContent(dto.imageBase64, dto.mediaType);
    const demo = demoModeEnabled;

    const content = sanitizeFoodContent(raw);

    await this.analytics.track('scan_food_content_completed', actorToAnalyticsFields(actor), {
      ingredientCount: content.ingredients.length,
      identified: content.dishName.length > 0,
      demo,
    });

    return { ...content, demo };
  }

  /** The confirm-before-write step — only ever called with a user-reviewed list. */
  async addPantryItems(dto: AddPantryItemsDto, userId: string) {
    const created = await this.prisma.pantryItem.createMany({
      data: dto.items.map((item) => ({
        userId,
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        source: 'scan_photo',
      })),
    });

    await this.analytics.track('scan_pantry_updated', { userId }, { itemCount: created.count });

    return { added: created.count };
  }
}
