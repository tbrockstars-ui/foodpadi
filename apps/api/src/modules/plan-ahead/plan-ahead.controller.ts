import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanAheadService } from './plan-ahead.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { AddShoppingListItemDto, UpdateShoppingListItemDto } from './dto/shopping-list-item.dto';

// Account-first by design (docs/FOODPADI_ONBOARDING_SPEC.md) — every route
// here requires a real account, unlike Cook Today's guest-or-auth guard.
@Controller('plan-ahead')
@UseGuards(JwtAuthGuard)
export class PlanAheadController {
  constructor(private readonly planAheadService: PlanAheadService) {}

  @Post('generate')
  generate(@Body() dto: GeneratePlanDto, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.generate(dto, user.userId);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.getCurrent(user.userId);
  }

  @Post(':planId/accept')
  accept(@Param('planId') planId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.accept(planId, user.userId);
  }

  @Post(':planId/items/:itemId/regenerate')
  regenerateItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.regenerateItem(planId, itemId, user.userId);
  }

  @Delete(':planId/items/:itemId')
  removeItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.removeItem(planId, itemId, user.userId);
  }

  @Post(':planId/shopping-list')
  generateShoppingList(@Param('planId') planId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.generateShoppingList(planId, user.userId);
  }

  @Get('shopping-lists/:listId')
  getShoppingList(@Param('listId') listId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.getShoppingList(listId, user.userId);
  }

  @Post('shopping-lists/:listId/items')
  addShoppingListItem(
    @Param('listId') listId: string,
    @Body() dto: AddShoppingListItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.addShoppingListItem(listId, user.userId, dto);
  }

  @Patch('shopping-lists/:listId/items/:itemId')
  updateShoppingListItem(
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.updateShoppingListItem(listId, itemId, user.userId, dto);
  }

  @Delete('shopping-lists/:listId/items/:itemId')
  removeShoppingListItem(
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.removeShoppingListItem(listId, itemId, user.userId);
  }
}
