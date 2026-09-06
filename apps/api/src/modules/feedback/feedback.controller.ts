import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

/**
 * Signed-in only (brief §27: guests get no persistent behavioural Memory) —
 * matches Companion's own JwtAuthGuard-only posture.
 */
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(user.userId, dto);
  }

  // Used by the client to check "have I already rated this?" before showing
  // a prompt, so the same occasion is never asked about twice.
  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.feedback.list(user.userId, entityType, entityId);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedback.update(user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.feedback.remove(user.userId, id);
  }
}
