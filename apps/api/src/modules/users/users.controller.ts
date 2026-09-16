import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getProfile(user.userId);
  }

  /** Partial profile update — country of residence, display name. */
  @Patch()
  updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('disclaimer-acknowledge')
  acknowledgeDisclaimer(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.acknowledgeDisclaimer(user.userId);
  }

  @Post('complete-onboarding')
  completeOnboarding(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.completeOnboarding(user.userId);
  }

  @Get('export')
  exportData(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.exportData(user.userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.usersService.deleteAccount(user.userId);
  }
}
