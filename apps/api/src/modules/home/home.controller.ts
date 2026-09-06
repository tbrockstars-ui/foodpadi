import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { GuestOrAuthGuard, RequestActor } from '../auth/guest-or-auth.guard';
import { HomeIdeasQueryDto } from './dto/home-ideas-query.dto';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  // Guest-accessible — deterministic curated data, no AI call, same posture as
  // the Plan Ahead preview. A guest just gets the un-personalised ordering
  // (no pantry to match against). No disclaimer gate: this shows recipe ideas,
  // it doesn't run a decision for the user. `mood`/`maxTime`/`maxBudget` are
  // the live "what should I eat?" signals (see home-ideas.ts's IdeaContext).
  @Get('ideas')
  @UseGuards(GuestOrAuthGuard)
  ideas(@Query() query: HomeIdeasQueryDto, @CurrentActor() actor: RequestActor) {
    return this.homeService.getIdeas(actor, query);
  }

  // Guest-accessible for the same reason as `ideas`: nothing here needs a
  // disclaimer gate or blocks on being signed in, it just has nothing to
  // show a guest (nothing persists for them) — GuestOrAuthGuard lets Home
  // call both endpoints the same way regardless of session state.
  @Get('recently-cooked')
  @UseGuards(GuestOrAuthGuard)
  recentlyCooked(@CurrentActor() actor: RequestActor) {
    return this.homeService.getRecentlyCooked(actor);
  }
}
