import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { PlanAheadController } from './plan-ahead.controller';
import { PlanPreviewController } from './plan-preview.controller';
import { PlanAheadService } from './plan-ahead.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [PlanAheadController, PlanPreviewController],
  providers: [PlanAheadService],
})
export class PlanAheadModule {}
