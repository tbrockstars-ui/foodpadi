import { Controller, Get, Param, Post, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Controller('admin/users')
@UseGuards(AdminApiGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.adminUsersService.detail(id);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.adminUsersService.suspend(id);
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.adminUsersService.reactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.adminUsersService.delete(id);
  }
}
