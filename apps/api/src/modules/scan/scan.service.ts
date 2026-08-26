import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ClaudeService } from '../ai/claude.service';
import { AddPantryItemsDto } from './dto/add-pantry-items.dto';
import { ScanPhotoDto } from './dto/scan-photo.dto';
import { sanitizeScannedItems, ScannedItemView } from './scan-validation';

@Injectable()
export class ScanService {
  constructor(
    private readonly claude: ClaudeService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Analyses a photo into candidate items — never persisted here. */
  async scanPhoto(dto: ScanPhotoDto, userId: string): Promise<ScannedItemView[]> {
    const raw = await this.claude.analyzeFoodPhoto(dto.imageBase64, dto.mediaType);
    const items = sanitizeScannedItems(raw);

    await this.analytics.track('scan_photo_analysed', { userId }, { itemCount: items.length });

    return items;
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

    await this.analytics.track('pantry_items_added', { userId }, { itemCount: created.count });

    return { added: created.count };
  }
}
