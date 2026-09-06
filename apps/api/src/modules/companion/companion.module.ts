import { Module } from '@nestjs/common';
import { CompanionController } from './companion.controller';
import { CompanionService } from './companion.service';
import { ContextService } from './context.service';
import { PatternService } from './pattern.service';

@Module({
  controllers: [CompanionController],
  providers: [PatternService, ContextService, CompanionService],
  // PatternService is also consumed directly by FeedbackModule (feedback
  // recompute triggers the same pattern refresh) — exported alongside
  // CompanionService rather than duplicated.
  exports: [PatternService, CompanionService],
})
export class CompanionModule {}
