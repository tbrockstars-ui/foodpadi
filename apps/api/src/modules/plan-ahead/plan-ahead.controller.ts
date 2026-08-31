import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanAheadService } from './plan-ahead.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { UpdateMealPlanItemDto } from './dto/update-meal-plan-item.dto';
import { RegeneratePlanItemDto } from './dto/regenerate-plan-item.dto';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto';
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

  // Every plan the user has generated, newest first — the "saved plans" list.
  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.list(user.userId);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.getCurrent(user.userId);
  }

  // Typeahead for "Replace with something specific" — titles the user can
  // pick from instead of free-typing a hint and finding out only after
  // submitting whether anything matched. Declared before the `:planId`
  // routes below so "meal-ideas" is never captured as a planId param.
  @Get('meal-ideas')
  searchMealIdeas(@Query('q') q: string | undefined) {
    return this.planAheadService.searchMealIdeas(q ?? '');
  }

  @Delete(':planId')
  remove(@Param('planId') planId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.remove(planId, user.userId);
  }

  @Post(':planId/accept')
  accept(@Param('planId') planId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.accept(planId, user.userId);
  }

  // Rebuild the whole plan (all days) — same scope/budget — for when the plan
  // as a whole misses, not just one day.
  @Post(':planId/regenerate')
  regeneratePlan(@Param('planId') planId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.planAheadService.regeneratePlan(planId, user.userId);
  }

  // Replace a single day. An optional `focus` steers that day specifically
  // ("something with fish", "a quick pasta") when the generated meal wasn't
  // what the user wanted.
  @Post(':planId/items/:itemId/regenerate')
  regenerateItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RegeneratePlanItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.regenerateItem(planId, itemId, user.userId, dto);
  }

  // Sets whether a day is Cook It or Eat Out and/or the planned time for it
  // — the client (currently mobile only) uses plannedTime to schedule a
  // local "30 minutes to go" reminder, so the user doesn't miss the window
  // to start cooking or place an order.
  @Patch(':planId/items/:itemId')
  updateItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMealPlanItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.updateItem(planId, itemId, user.userId, dto);
  }

  @Delete(':planId/items/:itemId')
  removeItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.removeItem(planId, itemId, user.userId);
  }

  // Body { regenerate?: boolean } — regenerate:true rebuilds an existing list
  // from the plan's current meals (keeps manually-added items).
  @Post(':planId/shopping-list')
  generateShoppingList(
    @Param('planId') planId: string,
    @Body() dto: GenerateShoppingListDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.planAheadService.generateShoppingList(planId, user.userId, dto);
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
