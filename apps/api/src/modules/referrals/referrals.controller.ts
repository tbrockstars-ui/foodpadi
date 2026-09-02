import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { TrackReferralShareDto } from './dto/track-referral-share.dto';

/**
 * Deliberately depends on ReferralsService only — NOT AnalyticsService. This
 * module is imported by the global AnalyticsModule (for the qualification
 * hook), so taking a dependency back on AnalyticsService here would close a
 * module cycle. Referral analytics events are emitted elsewhere:
 * `referral_attributed` from AuthService; share/dashboard telemetry is a
 * later add via an event emitter (see docs/REFERRAL_PLAN.md §2.8 / §5.2).
 */
@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** The member's invite dashboard: code, link, counts, tier/progress, unseen badges, recent list. */
  @Get('me')
  getMine(@CurrentUser() user: CurrentUserPayload) {
    return this.referrals.getSummary(user.userId);
  }

  /** Explicit "give me my code" trigger for the copy-link button. Idempotent. */
  @Post('code')
  async ensureCode(@CurrentUser() user: CurrentUserPayload) {
    return { code: await this.referrals.getOrCreateCode(user.userId) };
  }

  /** Lightweight link-only fetch for the contextual "share FoodPadi" nudges. */
  @Get('link')
  getLink(@CurrentUser() user: CurrentUserPayload) {
    return this.referrals.getShareLink(user.userId);
  }

  /** The dashboard calls this after showing a badge celebration. */
  @Post('milestones/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  ackMilestones(@CurrentUser() user: CurrentUserPayload) {
    return this.referrals.acknowledgeMilestones(user.userId);
  }

  /** Friend-side: was this account created via an invite, and is the welcome unseen? */
  @Get('received')
  getReceived(@CurrentUser() user: CurrentUserPayload) {
    return this.referrals.getReceivedStatus(user.userId);
  }

  @Post('received/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  ackWelcome(@CurrentUser() user: CurrentUserPayload) {
    return this.referrals.acknowledgeWelcome(user.userId);
  }

  /**
   * Client reports which channel a share was started through. Accepted and
   * validated now so the client contract is stable; wiring it to analytics
   * is a follow-up (needs an event emitter to stay off the module cycle).
   */
  @Post('share')
  @HttpCode(HttpStatus.NO_CONTENT)
  trackShare(@CurrentUser() _user: CurrentUserPayload, @Body() _dto: TrackReferralShareDto) {
    // no-op for Phase 1a
  }
}
