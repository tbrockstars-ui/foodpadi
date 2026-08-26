import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CookTodayService } from './cook-today.service';
import { GenerateRecipesDto } from './dto/generate-recipes.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';

@Controller('cook-today')
export class CookTodayController {
  constructor(private readonly cookTodayService: CookTodayService) {}

  // Guest-accessible by design (docs/FOODPADI_ONBOARDING_SPEC.md) — Cook
  // Today's value is a one-off answer, not a saved artifact.
  @Post('generate')
  @UseGuards(GuestOrAuthGuard)
  generate(@Body() dto: GenerateRecipesDto, @CurrentActor() actor: RequestActor) {
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException(
        'Acknowledge the food/safety disclaimer before viewing ingredient information.',
      );
    }
    return this.cookTodayService.generate(dto, actor);
  }

  // Saving is the persistence-requiring action that requires a real account
  // (docs/FOODPADI_ONBOARDING_SPEC.md's signup trigger) — no guest path here.
  @Post('recipes')
  @UseGuards(JwtAuthGuard)
  save(@Body() dto: SaveRecipeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.cookTodayService.save(dto, user.userId);
  }

  @Get('recipes')
  @UseGuards(JwtAuthGuard)
  listSaved(@CurrentUser() user: CurrentUserPayload) {
    return this.cookTodayService.listSaved(user.userId);
  }

  @Delete('recipes/:id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.cookTodayService.delete(id, user.userId);
  }
}
