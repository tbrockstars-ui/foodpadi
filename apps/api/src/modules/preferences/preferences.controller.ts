import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';
import { AddAvoidedIngredientDto } from './dto/add-avoided-ingredient.dto';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get('preferences')
  listPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.preferencesService.listPreferences(user.userId);
  }

  @Post('preferences')
  addPreference(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpsertPreferenceDto) {
    return this.preferencesService.addPreference(user.userId, dto);
  }

  @Delete('preferences/:id')
  async deletePreference(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.preferencesService.deletePreference(user.userId, id);
  }

  @Get('avoided-ingredients')
  listAvoidedIngredients(@CurrentUser() user: CurrentUserPayload) {
    return this.preferencesService.listAvoidedIngredients(user.userId);
  }

  @Post('avoided-ingredients')
  addAvoidedIngredient(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddAvoidedIngredientDto,
  ) {
    return this.preferencesService.addAvoidedIngredient(user.userId, dto);
  }

  @Delete('avoided-ingredients/:id')
  async removeAvoidedIngredient(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.preferencesService.removeAvoidedIngredient(user.userId, id);
  }
}
