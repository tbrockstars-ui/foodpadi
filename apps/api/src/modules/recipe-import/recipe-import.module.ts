import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecipeImportController } from './recipe-import.controller';
import { RecipeImportService } from './recipe-import.service';

@Module({
  imports: [AuthModule],
  controllers: [RecipeImportController],
  providers: [RecipeImportService],
})
export class RecipeImportModule {}
