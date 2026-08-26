import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { EatNowService } from './eat-now.service';
import { SearchEatNowDto } from './dto/search-eat-now.dto';

@Controller('eat-now')
export class EatNowController {
  constructor(private readonly eatNowService: EatNowService) {}

  // Guest-accessible by design (docs/FOODPADI_ONBOARDING_SPEC.md), same as
  // Cook Today — Eat Now's value is a one-off answer, not a saved artifact.
  @Post('search')
  @UseGuards(GuestOrAuthGuard)
  search(@Body() dto: SearchEatNowDto, @CurrentActor() actor: RequestActor) {
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException(
        'Acknowledge the food/safety disclaimer before searching for food.',
      );
    }
    return this.eatNowService.search(dto);
  }
}
