import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type {
  BillingConfigView,
  FxRatesView,
  UpdateBillingConfigResponse,
} from '@foodpadi/shared';
import { AdminApiGuard } from './admin-api.guard';
import { BillingConfigService } from '../billing/billing-config.service';
import { FxRateService } from '../billing/fx-rate.service';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';

/**
 * Dynamic parameterised subscription value management for the admin dashboard
 * (apps/web/app/admin/billing). Reads/writes the single `billing_config` row
 * via BillingConfigService — which also best-effort pushes price changes to
 * Stripe / Flutterwave. Behind AdminApiGuard like every other /admin/* route.
 */
@Controller('admin/billing')
@UseGuards(AdminApiGuard)
export class AdminBillingController {
  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly fx: FxRateService,
  ) {}

  @Get('config')
  getConfig(): Promise<BillingConfigView> {
    return this.billingConfig.getView();
  }

  @Patch('config')
  async updateConfig(@Body() dto: UpdateBillingConfigDto): Promise<UpdateBillingConfigResponse> {
    const { warnings } = await this.billingConfig.update(dto);
    const config = await this.billingConfig.getView();
    return { config, warnings };
  }

  /** Today's FX rates + the base price converted for every supported currency. */
  @Get('fx')
  async getFx(): Promise<FxRatesView> {
    const cfg = await this.billingConfig.getResolved();
    return this.fx.buildView(cfg.basePriceCents, cfg.baseCurrency);
  }

  /** Force a fresh pull from the FX feed now (the "Refresh rates" button). */
  @Post('fx/refresh')
  async refreshFx(): Promise<FxRatesView> {
    await this.fx.refresh().catch(() => undefined);
    const cfg = await this.billingConfig.getResolved();
    return this.fx.buildView(cfg.basePriceCents, cfg.baseCurrency);
  }
}
