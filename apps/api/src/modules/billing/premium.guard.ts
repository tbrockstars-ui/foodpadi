import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EntitlementService } from './entitlement.service';

/**
 * Route guard that requires an active FoodPadi Premium entitlement. Returns
 * HTTP 402 `{ code: 'premium_required' }` when the caller is not premium, so a
 * client can react by showing the upgrade prompt.
 *
 * IMPORTANT: shipped and unit-tested, but deliberately applied to ZERO routes
 * in this change. Which member features become premium-only is a separate,
 * focused decision — wiring `@UseGuards(JwtAuthGuard, PremiumGuard)` onto a
 * controller is all that is needed once that list exists. Nothing about
 * current feature access changes here.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    if (!userId) {
      throw new HttpException(
        { message: 'Authentication required.', code: 'auth_required' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const premium = await this.entitlements.isPremium(userId);
    if (!premium) {
      throw new HttpException(
        { message: 'FoodPadi Premium is required for this feature.', code: 'premium_required' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
