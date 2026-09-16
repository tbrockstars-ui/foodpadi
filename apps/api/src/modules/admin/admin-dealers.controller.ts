import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminDealersService } from './admin-dealers.service';
import { ListDealersQueryDto } from './dto/list-dealers-query.dto';
import { DealerAdminActionDto, UpdateDealerRatingDto, UpdateDealerReportDto } from './dto/dealer-admin.dto';

/**
 * Staff controls for the Food Dealer Network (dealer brief §39/§40/§68) —
 * behind AdminApiGuard like every other /admin/* route. A dealer never reaches
 * these. Every mutation re-runs the search-index rebuild in the service so a
 * moderation decision is reflected in customer search immediately.
 */
@Controller('admin/dealers')
@UseGuards(AdminApiGuard)
export class AdminDealersController {
  constructor(private readonly service: AdminDealersService) {}

  @Get()
  list(@Query() query: ListDealersQueryDto) {
    return this.service.list(query);
  }

  // Registered before ':id' so the literal path is never captured as an id.
  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  // approve / suspend / reactivate / verify / unverify
  @Post(':id/action')
  act(@Param('id') id: string, @Body() dto: DealerAdminActionDto) {
    return this.service.act(id, dto);
  }

  @Delete(':id/products/:productId')
  removeProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.service.removeProduct(id, productId);
  }

  @Patch(':id/reports/:reportId')
  updateReport(
    @Param('id') id: string,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateDealerReportDto,
  ) {
    return this.service.updateReport(id, reportId, dto);
  }

  // Hide/unhide a customer rating (brief §39/§40, user instruction 2026-09-11).
  @Patch(':id/ratings/:ratingId')
  updateRating(
    @Param('id') id: string,
    @Param('ratingId') ratingId: string,
    @Body() dto: UpdateDealerRatingDto,
  ) {
    return this.service.setRatingHidden(id, ratingId, dto);
  }
}
