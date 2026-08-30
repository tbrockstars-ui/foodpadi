import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { ScanFoodContentDto } from './dto/scan-food-content.dto';
import { ScanService } from './scan.service';

// Separate from ScanController on purpose: that controller is account-only
// (@UseGuards(JwtAuthGuard) at the class level, since it builds a persisted
// pantry) — this route reads nothing and writes nothing, so it gets the
// same guest-accessible guard as Decide/Eat Now/Cook Today instead.
@Controller('scan')
export class FoodContentController {
  constructor(private readonly scanService: ScanService) {}

  @Post('food-content')
  @UseGuards(GuestOrAuthGuard)
  scanFoodContent(@Body() dto: ScanFoodContentDto, @CurrentActor() actor: RequestActor) {
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException('Acknowledge the food/safety disclaimer before scanning a dish.');
    }
    return this.scanService.scanFoodContent(dto, actor);
  }
}
