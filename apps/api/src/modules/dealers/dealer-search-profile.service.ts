import { Injectable, Logger } from '@nestjs/common';
import { DEALER_FEATURED_MIN_COMPLETENESS } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerAuditService } from './dealer-audit.service';
import { scoreDealerCompleteness } from './dealer-completeness';
import { DEALER_LIMITS, normaliseTerms } from './dealer-taxonomy';

/**
 * Owns the denormalised `dealer_search_profiles` index. `rebuild(dealerId)` is
 * the ONLY writer — it is called after every portal write (name/products/
 * locations/…) AND every subscription state change (webhook activate / cancel /
 * renew), so DealerSearchService can serve a customer query from one indexed
 * read with no joins (dealer brief §35: reuse Postgres, no Elasticsearch).
 *
 * This is also the single authoritative gate for the admin-approval-before-
 * payment business rule (2026-09-11): `listingStatus` only ever transitions to
 * `active` from `approved` or `expired` here, REGARDLESS of what triggered the
 * rebuild (a webhook, a checkout sync, an admin action, a portal edit). Even if
 * a payment somehow succeeded for a dealer stuck at `pending_review` /
 * `changes_requested` / `rejected` / `suspended` / `draft` (e.g. a bypassed
 * client, a stray webhook), this method refuses to make them live — being paid
 * up is necessary but never sufficient. The brief §25 expiry policy is
 * enforced the same lazy way (no cron, mirroring billing/EntitlementService's
 * lazy trial-expiry): a listing that was `active` and whose subscription is no
 * longer active is flipped to `expired`; a renewal flips an `expired` (already
 * previously-approved) dealer straight back to `active` with no re-approval.
 */
@Injectable()
export class DealerSearchProfileService {
  private readonly logger = new Logger(DealerSearchProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: DealerEntitlementService,
    private readonly audit: DealerAuditService,
  ) {}

  async rebuild(dealerId: string): Promise<void> {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { locations: true, products: true },
    });
    if (!dealer || dealer.deletedAt) {
      // Deleted / never existed — make sure no stale index row can be matched.
      await this.prisma.dealerSearchProfile
        .delete({ where: { dealerId } })
        .catch(() => undefined);
      return;
    }

    const subscriptionActive = await this.entitlement.isActive(dealerId);

    // --- lazy listing-status transitions ------------------------------------
    // Activation (admin-approval-before-payment, 2026-09-11): the ONLY paths to
    // 'active' are 'approved' + a paid subscription (first activation) or
    // 'expired' + a paid subscription (renewal, already previously approved).
    // Every other status ('draft', 'pending_review', 'changes_requested',
    // 'rejected', 'suspended') is left exactly as-is no matter what the
    // subscription says — this is the defense-in-depth layer: a payment that
    // somehow succeeded before approval still cannot make the dealer live.
    let listingStatus = dealer.listingStatus;
    if (!subscriptionActive && listingStatus === 'active') {
      listingStatus = 'expired'; // brief §25 lazy expiry
    } else if (subscriptionActive && (listingStatus === 'approved' || listingStatus === 'expired')) {
      listingStatus = 'active';
    }
    const firstActivation = listingStatus === 'active' && dealer.listingStatus !== 'active' && !dealer.activatedAt;

    const completeness = scoreDealerCompleteness({
      name: dealer.name,
      description: dealer.description,
      dealerType: dealer.dealerType,
      phone: dealer.phone,
      websiteUrl: dealer.websiteUrl,
      orderUrl: dealer.orderUrl,
      whatsapp: dealer.whatsapp,
      openingHours: dealer.openingHours,
      categories: dealer.categories,
      cuisines: dealer.cuisines,
      locationCount: dealer.locations.length,
      productCount: dealer.products.length,
    });

    if (listingStatus !== dealer.listingStatus || completeness !== dealer.profileCompleteness) {
      await this.prisma.dealer.update({
        where: { id: dealerId },
        data: {
          listingStatus,
          profileCompleteness: completeness,
          ...(firstActivation ? { activatedAt: new Date() } : {}),
        },
      });
      if (listingStatus !== dealer.listingStatus) {
        await this.audit.record({
          dealerId,
          action: listingStatus === 'active' ? 'activated' : listingStatus === 'expired' ? 'subscription_expired' : 'listing_status_changed',
          previousStatus: dealer.listingStatus,
          newStatus: listingStatus,
          reason: listingStatus === 'active' ? 'Subscription payment succeeded.' : null,
        });
      }
    }

    const productNames = dealer.products.map((p) => p.name);
    const categoriesNorm = normaliseTerms(dealer.categories).slice(0, DEALER_LIMITS.categories);
    const cuisinesNorm = normaliseTerms(dealer.cuisines).slice(0, DEALER_LIMITS.cuisines);
    const productsNorm = normaliseTerms([
      ...productNames,
      ...dealer.productKeywords,
      ...dealer.products.flatMap((p) => p.keywords ?? []),
    ]).slice(0, DEALER_LIMITS.productKeywords);
    const localities = normaliseTerms([
      ...dealer.locations.map((l) => l.locality),
      ...dealer.locations.flatMap((l) => l.serviceAreas ?? []),
      ...dealer.locations.map((l) => l.city ?? '').filter(Boolean),
    ]);

    const primary =
      dealer.locations.find((l) => l.isPrimary) ?? dealer.locations[0] ?? null;

    const searchText = normaliseTerms([
      dealer.name,
      ...dealer.categories,
      ...dealer.cuisines,
      ...productNames,
      ...dealer.locations.map((l) => l.locality),
      ...dealer.locations.flatMap((l) => l.serviceAreas ?? []),
      dealer.description ?? '',
    ]).join(' ');

    const featuredEligible =
      listingStatus === 'active' &&
      subscriptionActive &&
      completeness >= DEALER_FEATURED_MIN_COMPLETENESS;

    const row = {
      searchText,
      localities,
      categoriesNorm,
      productsNorm,
      cuisinesNorm,
      primaryLat: primary?.latitude ?? null,
      primaryLng: primary?.longitude ?? null,
      completeness,
      ratingAverage: dealer.ratingAverage,
      ratingCount: dealer.ratingCount,
      featuredEligible,
      listingStatus,
      subscriptionActive,
    };

    await this.prisma.dealerSearchProfile.upsert({
      where: { dealerId },
      create: { dealerId, ...row },
      update: { ...row, lastBuiltAt: new Date() },
    });
  }
}
