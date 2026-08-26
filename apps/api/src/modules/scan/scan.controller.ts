import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddPantryItemsDto } from './dto/add-pantry-items.dto';
import { ScanPhotoDto } from './dto/scan-photo.dto';
import { ScanService } from './scan.service';

// Account-only, no guest access — a scan builds your personal pantry, which
// only exists for a real account (same precedent as Plan Ahead).
@Controller()
@UseGuards(JwtAuthGuard)
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('scan/photo')
  scanPhoto(@Body() dto: ScanPhotoDto, @CurrentUser() user: CurrentUserPayload) {
    return this.scanService.scanPhoto(dto, user.userId);
  }

  @Post('pantry/items')
  addPantryItems(@Body() dto: AddPantryItemsDto, @CurrentUser() user: CurrentUserPayload) {
    return this.scanService.addPantryItems(dto, user.userId);
  }
}
