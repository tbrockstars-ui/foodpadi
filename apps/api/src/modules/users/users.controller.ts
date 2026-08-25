import { Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getProfile(user.userId);
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
