import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportRecipeDto } from './dto/import-recipe.dto';
import { RecipeImportService } from './recipe-import.service';

// Account-only: importing builds your personal recipe box, same gating as
// the existing "save a recipe" action on Cook Today.
@Controller('recipe-import')
@UseGuards(JwtAuthGuard)
export class RecipeImportController {
  constructor(private readonly recipeImportService: RecipeImportService) {}

  @Post()
  import(@Body() dto: ImportRecipeDto) {
    return this.recipeImportService.importFromUrl(dto);
  }
}
