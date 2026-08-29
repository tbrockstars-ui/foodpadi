import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { LocalFoodSearchService } from './local-food-search.service';
import { LocalFoodSearchDto } from './dto/local-food-search.dto';

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
}
