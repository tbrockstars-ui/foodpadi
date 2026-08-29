import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Service-to-service trust boundary for /admin/* — the caller is expected to
 * be apps/web's admin-proxy route (never a browser directly), which only
 * forwards here after checking its own ADMIN_SESSION_COOKIE. This guard just
 * confirms the request actually came from that trusted server, via a shared
 * secret never sent to any browser.
 *
 * This is NOT per-person staff authentication (apps/web/README.md's "Admin
 * auth is a placeholder" section is the source of truth on that gap) — it
 * only proves "this request came from the web app's admin area," not "which
 * staff member made it." Do not extend this guard's trust model without
 * closing that gap first.
 */
@Injectable()
export class AdminApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = process.env.ADMIN_API_SECRET;
    if (!configured) {
      throw new UnauthorizedException('Admin API is not configured.');
    }

    const request = context.switchToHttp().getRequest();
    const provided: string | undefined = request.headers?.['x-admin-api-secret'];
    if (!provided) {
      throw new UnauthorizedException('Missing admin credentials.');
    }

    const providedBuffer = Buffer.from(provided);
    const configuredBuffer = Buffer.from(configured);
    if (
      providedBuffer.length !== configuredBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, configuredBuffer)
    ) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    return true;
  }
}
