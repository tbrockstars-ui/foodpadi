import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { MailerService } from '../../common/mailer.service';
import { GuestSessionController } from './guest-session.controller';
import { GuestSessionService } from './guest-session.service';
import { GuestOrAuthGuard } from './guest-or-auth.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, GuestSessionController],
  providers: [AuthService, JwtStrategy, MailerService, GuestSessionService, GuestOrAuthGuard],
  exports: [AuthService, GuestSessionService, GuestOrAuthGuard, JwtModule],
})
export class AuthModule {}
