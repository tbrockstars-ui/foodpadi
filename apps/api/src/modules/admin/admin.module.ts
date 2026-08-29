import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminWaitlistController } from './admin-waitlist.controller';
import { AdminWaitlistService } from './admin-waitlist.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

@Module({
  controllers: [AdminUsersController, AdminWaitlistController, AdminAuthController],
  providers: [AdminUsersService, AdminWaitlistService, AdminAuthService],
})
export class AdminModule {}
