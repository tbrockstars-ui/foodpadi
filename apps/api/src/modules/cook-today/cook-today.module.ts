import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { CookTodayController } from './cook-today.controller';
import { CookTodayService } from './cook-today.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [CookTodayController],
  providers: [CookTodayService],
})
export class CookTodayModule {}
