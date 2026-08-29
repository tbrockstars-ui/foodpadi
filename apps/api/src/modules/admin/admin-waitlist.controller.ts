import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminWaitlistService } from './admin-waitlist.service';
import { ListWaitlistQueryDto } from './dto/list-waitlist-query.dto';

@Controller('admin/waitlist')
@UseGuards(AdminApiGuard)
export class AdminWaitlistController {
  constructor(private readonly adminWaitlistService: AdminWaitlistService) {}

  @Get()
  list(@Query() query: ListWaitlistQueryDto) {
    return this.adminWaitlistService.list(query);
  }
}
