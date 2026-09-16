import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { AnalyticsService } from './analytics.service';
import { TrackClientEventDto } from './dto/track-client-event.dto';

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

/**
 * The one client-writable analytics entry point — for the handful of Cook
 * Today funnel steps that have no natural backend request of their own to
 * piggyback on (see TrackClientEventDto's comment for the full list of
 * steps that already track inline elsewhere). Guest-accessible for the same
 * reason Cook Today's own generate() route is: this funnel starts before a
 * guest has any reason to sign up. `eventType` is a closed allowlist, not
 * free text, so this can never become a general "track anything" sink.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('track')
  @UseGuards(GuestOrAuthGuard)
  async track(@Body() dto: TrackClientEventDto, @CurrentActor() actor: RequestActor) {
    await this.analytics.track(dto.eventType, actorToAnalyticsFields(actor), dto.metadata ? { ...dto.metadata } : undefined);
  }
}
