import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { DecideService } from './decide.service';
import { DecideDto } from './dto/decide.dto';

@Controller('decide')
export class DecideController {
  constructor(private readonly decideService: DecideService) {}

  // Guest-accessible, same precedent as the two engines it blends (Cook
  // Today, Eat Now) — this is the unified "What should I eat?" entry point,
  // it should never be more locked-down than the things it calls.
  @Post()
  @UseGuards(GuestOrAuthGuard)
  decide(@Body() dto: DecideDto, @CurrentActor() actor: RequestActor) {
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException('Acknowledge the food/safety disclaimer before asking FoodPadi to decide.');
    }
    return this.decideService.decide(dto, actor);
  }
}
