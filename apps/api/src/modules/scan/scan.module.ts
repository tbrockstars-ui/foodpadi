import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [AuthModule, AiModule, AnalyticsModule],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}
