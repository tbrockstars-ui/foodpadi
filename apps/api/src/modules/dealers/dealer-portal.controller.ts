import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DealerPortalService } from './dealer-portal.service';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { DealerLocationDto } from './dto/dealer-location.dto';
import { DealerProductDto } from './dto/dealer-product.dto';
import { DealerCheckoutDto, DealerCheckoutSyncDto } from './dto/dealer-checkout.dto';

/**
 * The web-only Food Dealer portal — onboarding wizard + dashboard (dealer brief
 * §15/§49). Every route is JWT-guarded and scoped to the caller's OWN dealer by
 * DealerPortalService; a client-supplied dealerId is never accepted (brief §52).
 * A dealer signs in with an ordinary customer account (brief §51) — this
 * controller only ever exposes that account's dealer data, never customer
 * Memory / history / preferences.
 */
@Controller('dealers/me')
@UseGuards(JwtAuthGuard)
export class DealerPortalController {
  constructor(private readonly portal: DealerPortalService) {}

  @Get()
  getMine(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.getMine(user.userId);
  }

  @Post()
  create(@Body() dto: CreateDealerDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.create(user.userId, dto);
  }

  @Patch()
  update(@Body() dto: UpdateDealerDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.update(user.userId, dto);
  }

  // --- locations ----------------------------------------------------------
  @Post('locations')
  addLocation(@Body() dto: DealerLocationDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.addLocation(user.userId, dto);
  }

  @Patch('locations/:id')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: DealerLocationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.portal.updateLocation(user.userId, id, dto);
  }

  @Delete('locations/:id')
  removeLocation(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.removeLocation(user.userId, id);
  }

  // --- products ---------------------------------------------------------
  @Post('products')
  addProduct(@Body() dto: DealerProductDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.addProduct(user.userId, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: DealerProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.portal.updateProduct(user.userId, id, dto);
  }

  @Delete('products/:id')
  removeProduct(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.removeProduct(user.userId, id);
  }

  // Copies a product (including any uploaded image bytes) server-side — the
  // client never has to fetch/re-upload the image just to duplicate a row.
  @Post('products/:id/duplicate')
  duplicateProduct(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.duplicateProduct(user.userId, id);
  }

  // --- lifecycle ------------------------------------------------------
  @Get('submit')
  getSubmitState(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.getSubmitState(user.userId);
  }

  @Post('submit')
  submit(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.submit(user.userId);
  }

  @Get('preview')
  preview(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.getPreview(user.userId);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.getAnalytics(user.userId);
  }

  // --- subscription -------------------------------------------------
  @Get('subscription')
  getSubscription(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.getSubscription(user.userId);
  }

  @Post('subscription/checkout')
  checkout(@Body() dto: DealerCheckoutDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.createCheckout(user.userId, user.email, dto.provider);
  }

  @Post('subscription/portal')
  portalLink(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.createPortal(user.userId);
  }

  @Post('subscription/cancel')
  cancel(@CurrentUser() user: CurrentUserPayload) {
    return this.portal.cancelSubscription(user.userId);
  }

  @Post('subscription/sync')
  sync(@Body() dto: DealerCheckoutSyncDto, @CurrentUser() user: CurrentUserPayload) {
    return this.portal.syncCheckout(user.userId, user.email, dto);
  }
}
