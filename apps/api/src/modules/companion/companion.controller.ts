import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { CompanionService } from './companion.service';
import { CompanionActionDto } from './dto/companion-action.dto';
import { UpdateCompanionPreferencesDto } from './dto/update-companion-preferences.dto';

/**
 * Members only — a guest never calls any of this (guest-mode brief §16: no
 * persistent behavioural profiling for guests; matches packages/shared's
 * own comment on the Companion types).
 */
@Controller('companion')
@UseGuards(JwtAuthGuard)
export class CompanionController {
  constructor(private readonly companion: CompanionService) {}

  @Get('suggestion')
  async getSuggestion(@CurrentUser() user: CurrentUserPayload) {
    const suggestion = await this.companion.getSuggestion(user.userId);
    return { suggestion };
  }

  @Post('suggestion/:id/action')
  @HttpCode(HttpStatus.NO_CONTENT)
  async action(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CompanionActionDto,
  ) {
    await this.companion.recordAction(user.userId, id, dto.action);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.companion.getPreferences(user.userId);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateCompanionPreferencesDto) {
    return this.companion.updatePreferences(user.userId, dto);
  }

  @Post('memory/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetMemory(@CurrentUser() user: CurrentUserPayload) {
    await this.companion.resetMemory(user.userId);
  }
}
