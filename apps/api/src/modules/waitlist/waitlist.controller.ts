import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async join(@Body() dto: JoinWaitlistDto) {
    await this.waitlistService.join(dto.email);
    return { ok: true };
  }
}
