import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EatNowController } from './eat-now.controller';
import { EatNowService } from './eat-now.service';

@Module({
  imports: [AuthModule],
  controllers: [EatNowController],
  providers: [EatNowService],
})
export class EatNowModule {}
