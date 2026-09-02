import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScanFoodContentDto } from './dto/scan-food-content.dto';
import { ScanService } from './scan.service';

// "What's in this dish?" identifies a dish from a photo via the vision model.
// That is a paid AI call, so it is account-only: a guest must never be able
// to trigger one (guest-mode brief §2 — zero Anthropic calls for guests).
// Guest tokens are signed with a different secret and fail JwtAuthGuard's
// signature check before reaching the handler; the client shows a "create a
// free account" prompt instead.
@Controller('scan')
@UseGuards(JwtAuthGuard)
export class FoodContentController {
  constructor(private readonly scanService: ScanService) {}

  @Post('food-content')
  scanFoodContent(@Body() dto: ScanFoodContentDto, @CurrentUser() user: CurrentUserPayload) {
    return this.scanService.scanFoodContent(dto, user.userId);
  }
}
