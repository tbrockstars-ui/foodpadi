import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { CookingJourneyService } from './cooking-journey.service';
import { CreateCookingJourneyDto } from './dto/create-cooking-journey.dto';
import { UpdateCookingJourneyDto } from './dto/update-cooking-journey.dto';
import { UpdateCookingJourneyTimerDto } from './dto/update-cooking-journey-timer.dto';

/**
 * The persistent cooking journey — signed-in only (a guest has no stable
 * account to attach a resumable flow to; they keep today's in-memory Cook
 * Today flow). Same JwtAuthGuard-only posture as cooking-assistant / feedback.
 */
@Controller('cooking-journey')
@UseGuards(JwtAuthGuard)
export class CookingJourneyController {
  constructor(private readonly journeys: CookingJourneyService) {}

  // The Cook landing page's only call — returns the one active journey (or
  // null) with the resolved recipe, shopping summary and resume destination.
  @Get('active')
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.journeys.getActive(user.userId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCookingJourneyDto) {
    return this.journeys.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCookingJourneyDto,
  ) {
    return this.journeys.update(user.userId, id, dto);
  }

  @Patch(':id/timer')
  updateTimer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCookingJourneyTimerDto,
  ) {
    return this.journeys.updateTimer(user.userId, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.journeys.complete(user.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.journeys.cancel(user.userId, id);
  }
}
