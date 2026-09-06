import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { LocalFoodSearchService } from './local-food-search.service';
import { LocalFoodSearchDto } from './dto/local-food-search.dto';
import { LocalFoodSearchInteractionDto } from './dto/local-food-search-interaction.dto';

@Controller('local-food-search')
export class LocalFoodSearchController {
  constructor(private readonly localFoodSearchService: LocalFoodSearchService) {}

  // Guest-accessible, same precedent as Eat Now/Cook Today — this is a
  // one-off answer to "where can I get this nearby?", not a saved artifact.
  @Post()
  @UseGuards(GuestOrAuthGuard)
  search(@Body() dto: LocalFoodSearchDto, @CurrentActor() actor: RequestActor) {
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException(
        'Acknowledge the food/safety disclaimer before searching for food nearby.',
      );
    }
    return this.localFoodSearchService.search(dto, actor);
  }

  // "Find Near Me" brief §16 — client-only interactions the server can't
  // otherwise observe (a permission prompt's outcome, tapping a maps/order
  // link). Same guest-accessible posture as the search itself; no disclaimer
  // gate here since nothing is searched or shown as a result of this call.
  @Post('interaction')
  @UseGuards(GuestOrAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackInteraction(
    @Body() dto: LocalFoodSearchInteractionDto,
    @CurrentActor() actor: RequestActor,
  ): Promise<void> {
    await this.localFoodSearchService.trackInteraction(dto, actor);
  }
}
