import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { PlanPreviewQueryDto } from './dto/plan-preview.dto';
import { PlanAheadService } from './plan-ahead.service';

/**
 * Separate from PlanAheadController (which is JwtAuthGuard at the class
 * level) so this one route can be guest-accessible. It is AI-free: the
 * preview is drawn from the curated recipe pool (curated-recipes.ts), never
 * ClaudeService — a guest must never trigger a paid AI call (guest-mode
 * brief §2/§8). Nothing is persisted; a real saved/reminder-backed plan
 * still requires an account.
 */
@Controller('plan-ahead')
export class PlanPreviewController {
  constructor(private readonly planAheadService: PlanAheadService) {}

  @Get('preview')
  @UseGuards(GuestOrAuthGuard)
  preview(@Query() query: PlanPreviewQueryDto, @CurrentActor() actor: RequestActor) {
    // Same food-safety boundary the other guest-accessible recipe endpoints
    // enforce — the preview shows ingredients.
    if (actor.type === 'guest' && !actor.disclaimerAcknowledged) {
      throw new ForbiddenException(
        'Acknowledge the food/safety disclaimer before previewing a plan.',
      );
    }
    return this.planAheadService.preview(query.days ?? 3, actor);
  }
}
