import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminFoodIdeasService } from './admin-food-ideas.service';
import { CreateFoodIdeaDto } from './dto/create-food-idea.dto';
import { ListFoodIdeasQueryDto } from './dto/list-food-ideas-query.dto';
import { UpdateFoodIdeaDto } from './dto/update-food-idea.dto';

@Controller('admin/food-ideas')
@UseGuards(AdminApiGuard)
export class AdminFoodIdeasController {
  constructor(private readonly adminFoodIdeasService: AdminFoodIdeasService) {}

  @Get()
  list(@Query() query: ListFoodIdeasQueryDto) {
    return this.adminFoodIdeasService.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.adminFoodIdeasService.detail(id);
  }

  @Post()
  create(@Body() dto: CreateFoodIdeaDto) {
    return this.adminFoodIdeasService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFoodIdeaDto) {
    return this.adminFoodIdeasService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.adminFoodIdeasService.delete(id);
  }
}
