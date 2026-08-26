import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { GuestSessionService } from './guest-session.service';

class GuestSessionTokenDto {
  @IsString()
  guestToken!: string;
}

@Controller('auth/guest-session')
export class GuestSessionController {
  constructor(private readonly guestSessionService: GuestSessionService) {}

  @Post()
  create() {
    return { guestToken: this.guestSessionService.issue() };
  }

  @Post('disclaimer-acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledgeDisclaimer(@Body() dto: GuestSessionTokenDto) {
    return { guestToken: this.guestSessionService.acknowledgeDisclaimer(dto.guestToken) };
  }
}
