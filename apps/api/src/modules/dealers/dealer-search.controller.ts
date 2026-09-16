import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { GuestOrAuthGuard } from '../auth/guest-or-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DealerSearchService } from './dealer-search.service';
import { DealerRatingService } from './dealer-rating.service';
import { DealerSearchDto, DealerReportDto, RecordDealerEventDto } from './dto/dealer-search.dto';
import { ListDealerRatingsQueryDto, SubmitDealerRatingDto } from './dto/dealer-rating.dto';

/**
 * Customer-facing Food Dealer discovery (dealer brief §19/§20/§65). The search
 * endpoint keeps the same guest-or-auth posture as local-food-search (it's
 * reached from inside the app's Find Nearby flow, which always has a
 * session/guest token). The engine is fully deterministic — no Anthropic call
 * is ever made here, so it satisfies the guest zero-AI rule and stays
 * cost-efficient at any traffic level (brief §57/§74).
 *
 * The web + mobile clients consume this identically (brief §21/§64).
 */
@Controller('dealers')
@UseGuards(GuestOrAuthGuard)
export class DealerSearchController {
  constructor(private readonly search: DealerSearchService) {}

  // GET /dealers/search?q=&locality=&latitude=&longitude=&category=&dealerType=&page=
  @Get('search')
  searchDealers(@Query() query: DealerSearchDto) {
    return this.search.search(query);
  }
}

/**
 * The PUBLIC dealer surface — no auth at all, so a shared link and a search-
 * engine crawler both work (dealer brief §33/§34/§48). Only ever returns the
 * curated public view; a lapsed/suspended listing 404s (brief §25/§27).
 */
@Controller('dealers')
export class DealerPublicController {
  constructor(private readonly search: DealerSearchService) {}

  // Serves an uploaded product photo's actual bytes — the JSON views only ever
  // carry this path (see toProductView in dealer-view.ts), never the image
  // data itself, so list/search responses stay small (dealer brief follow-up,
  // user instruction 2026-09-15). Long-cached: the URL is stable per product
  // and a re-upload always overwrites in place, so this simply won't be hit
  // again until then anyway.
  @Get('products/:id/image')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getProductImage(@Param('id') id: string): Promise<StreamableFile> {
    const image = await this.search.getProductImage(id);
    if (!image) throw new NotFoundException();
    return new StreamableFile(image.data, { type: image.mimeType, disposition: 'inline' });
  }

  @Get(':slug')
  getProfile(@Param('slug') slug: string) {
    return this.search.getPublicProfile(slug);
  }

  // Contact / directions / order-link clicks — fire-and-forget, no PII
  // (mirrors local-food-search/interaction).
  @Post(':slug/events')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordEvent(@Param('slug') slug: string, @Body() dto: RecordDealerEventDto) {
    return this.search.recordEvent(slug, dto.type);
  }

  // Customer report of a wrong / closed / incorrect / inappropriate listing
  // (brief §40). Public — anyone can report; no user identity is stored.
  @Post(':slug/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@Param('slug') slug: string, @Body() dto: DealerReportDto) {
    return this.search.report(slug, dto, null);
  }
}

/**
 * Post-visit customer ratings (user instruction 2026-09-11). The read side is
 * public (the /dealer/[slug] page's server-side fetch carries no auth, same
 * reasoning as DealerPublicController above) — a request never gets rejected
 * for lacking a token. But when a REAL user token IS present, we opportunistically
 * decode it (never a guest token — different signing scheme entirely, so it
 * simply fails to verify and falls back to anonymous) so the response can flag
 * the caller's own entry as `isMine`, without ever exposing anyone else's
 * identity (brief §42) or requiring the strict all-or-nothing GuestOrAuthGuard.
 */
@Controller('dealers')
export class DealerRatingsReadController {
  constructor(
    private readonly ratings: DealerRatingService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':slug/ratings')
  async list(@Param('slug') slug: string, @Query() query: ListDealerRatingsQueryDto, @Req() req: Request) {
    const callerUserId = await this.optionalUserId(req);
    return this.ratings.list(slug, query.page ?? 1, callerUserId);
  }

  private async optionalUserId(req: Request): Promise<string | null> {
    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice('Bearer '.length), {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-insecure-secret',
      });
      return payload.sub ?? null;
    } catch {
      return null; // absent, malformed, expired, or a guest token — all fine, just anonymous
    }
  }
}

@Controller('dealers')
@UseGuards(JwtAuthGuard)
export class DealerRatingsController {
  constructor(private readonly ratings: DealerRatingService) {}

  @Get(':slug/ratings/me')
  getMine(@Param('slug') slug: string, @CurrentUser() user: CurrentUserPayload) {
    return this.ratings.getMine(slug, user.userId);
  }

  @Post(':slug/ratings')
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitDealerRatingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ratings.submit(slug, user.userId, dto);
  }

  @Delete(':slug/ratings/me')
  removeMine(@Param('slug') slug: string, @CurrentUser() user: CurrentUserPayload) {
    return this.ratings.removeMine(slug, user.userId);
  }
}
