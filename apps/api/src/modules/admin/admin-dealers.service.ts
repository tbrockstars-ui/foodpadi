import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Dealer, DealerLocation, DealerProduct, DealerSubscription } from '@prisma/client';
import type {
  AdminDealerDetail,
  AdminDealerListItem,
  AdminDealerListResponse,
  AdminDealerOverview,
  DealerListingStatus,
  DealerType,
  DealerVerificationStatus,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../../common/mailer.service';
import { DealerEntitlementService } from '../dealers/dealer-entitlement.service';
import { DealerSearchProfileService } from '../dealers/dealer-search-profile.service';
import { DealerRatingService } from '../dealers/dealer-rating.service';
import { DealerAuditService } from '../dealers/dealer-audit.service';
import { toOwnerLocationView, toOwnerProductView } from '../dealers/dealer-view';
import { ListDealersQueryDto } from './dto/list-dealers-query.dto';
import { DealerAdminActionDto, UpdateDealerRatingDto, UpdateDealerReportDto } from './dto/dealer-admin.dto';

const PAGE_SIZE = 30;

type DealerRow = Dealer & {
  owner: { email: string } | null;
  subscription: DealerSubscription | null;
  locations: DealerLocation[];
  products: DealerProduct[];
  _count?: { reports: number };
};

/**
 * Staff controls for the Food Dealer Network (dealer brief §39/§40/§68).
 * A dealer can never reach these routes — they sit under /admin behind
 * AdminApiGuard. Every state change re-runs DealerSearchProfileService.rebuild
 * so the customer search index reflects the moderation decision immediately.
 */
@Injectable()
export class AdminDealersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: DealerEntitlementService,
    private readonly searchProfile: DealerSearchProfileService,
    private readonly ratings: DealerRatingService,
    private readonly audit: DealerAuditService,
    private readonly mailer: MailerService,
  ) {}

  /** Application-queue counts for the admin Food Dealer overview strip. */
  async overview(): Promise<AdminDealerOverview> {
    const rows = await this.prisma.dealer.groupBy({
      by: ['listingStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const counts = new Map(rows.map((r) => [r.listingStatus, r._count._all]));
    return {
      draft: counts.get('draft') ?? 0,
      pendingReview: counts.get('pending_review') ?? 0,
      changesRequested: counts.get('changes_requested') ?? 0,
      approvedUnpaid: counts.get('approved') ?? 0,
      active: counts.get('active') ?? 0,
      rejected: counts.get('rejected') ?? 0,
      suspended: counts.get('suspended') ?? 0,
      expired: counts.get('expired') ?? 0,
    };
  }

  async list(query: ListDealersQueryDto): Promise<AdminDealerListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status) where.listingStatus = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q.toLowerCase() } },
        { owner: { email: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    if (query.filter === 'reported') {
      where.reports = { some: { status: 'open' } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.dealer.findMany({
        where,
        include: {
          owner: { select: { email: true } },
          subscription: true,
          locations: true,
          products: true,
          _count: { select: { reports: { where: { status: 'open' } } } },
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.dealer.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toListItem(r as DealerRow)),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async detail(id: string): Promise<AdminDealerDetail> {
    const row = await this.loadRow(id);
    const [reports, ratings, auditLog] = await Promise.all([
      this.prisma.dealerReport.findMany({
        where: { dealerId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.ratings.listForAdmin(id),
      this.audit.list(id),
    ]);
    const base = this.toListItem(row);
    return {
      ...base,
      description: row.description,
      categories: row.categories,
      cuisines: row.cuisines,
      productKeywords: row.productKeywords,
      dietaryTags: row.dietaryTags,
      phone: row.phone,
      websiteUrl: row.websiteUrl,
      orderUrl: row.orderUrl,
      whatsapp: row.whatsapp,
      openingHours: (row.openingHours as Record<string, string> | null) ?? null,
      featuredEligible:
        base.isLiveToCustomers && row.profileCompleteness >= 70,
      approvalNote: row.approvalNote,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      locations: row.locations.map(toOwnerLocationView),
      products: row.products.map(toOwnerProductView),
      reports: reports.map((rep) => ({
        id: rep.id,
        reason: rep.reason as AdminDealerDetail['reports'][number]['reason'],
        detail: rep.detail,
        status: rep.status,
        createdAt: rep.createdAt.toISOString(),
        reviewedAt: rep.reviewedAt?.toISOString() ?? null,
      })),
      ratings,
      auditLog,
    };
  }

  /**
   * approve / reject / request_changes / suspend / reactivate / verify /
   * unverify. Admin-approval-before-payment (2026-09-11): 'approve' moves a
   * dealer to `approved` — NOT `active` — the dealer still has to choose and
   * pay for a subscription (createCheckout enforces that gate independently).
   * Every transition here is guarded by the dealer's CURRENT status, which
   * also makes double-clicking an action idempotent-safe: a second 'approve'
   * on an already-`approved` dealer hits the guard and throws rather than
   * re-recording the decision or re-sending the notification (brief §37).
   */
  async act(id: string, dto: DealerAdminActionDto): Promise<AdminDealerDetail> {
    const row = await this.loadRow(id);
    const data: Record<string, unknown> = {};
    let notify: 'approved' | 'changes_requested' | 'rejected' | null = null;

    switch (dto.action) {
      case 'approve':
        if (row.listingStatus !== 'pending_review') {
          throw new BadRequestException('Only an application pending review can be approved.');
        }
        data.listingStatus = 'approved';
        data.approvalReviewedAt = new Date();
        data.approvalNote = null;
        notify = 'approved';
        break;
      case 'request_changes': {
        if (row.listingStatus !== 'pending_review') {
          throw new BadRequestException('Only an application pending review can have changes requested.');
        }
        const note = dto.note?.trim();
        if (!note) {
          throw new BadRequestException('A message telling the dealer what to change is required.');
        }
        data.listingStatus = 'changes_requested';
        data.approvalNote = note;
        notify = 'changes_requested';
        break;
      }
      case 'reject': {
        if (!['pending_review', 'changes_requested'].includes(row.listingStatus)) {
          throw new BadRequestException('Only a pending application can be rejected.');
        }
        const note = dto.note?.trim();
        if (!note) {
          throw new BadRequestException('A rejection reason is required.');
        }
        data.listingStatus = 'rejected';
        data.approvalReviewedAt = new Date();
        data.approvalNote = note;
        notify = 'rejected';
        break;
      }
      case 'suspend':
        data.listingStatus = 'suspended';
        break;
      case 'reactivate':
        if (row.listingStatus !== 'suspended' && row.listingStatus !== 'expired') {
          throw new BadRequestException('Only a suspended or expired listing can be reactivated.');
        }
        // A lapsed subscription still gates customer visibility (brief §25) —
        // the search-profile rebuild below would immediately flip an `active`
        // listing back to `expired`. Reactivation only sticks once the dealer
        // is paid up again; say so rather than silently no-op.
        if (row.listingStatus === 'expired' && !this.entitlement.computeEntitlement(row.subscription).active) {
          throw new BadRequestException(
            "This listing expired because the dealer's subscription lapsed. It becomes visible again automatically once they renew — there is nothing to reactivate manually.",
          );
        }
        data.listingStatus = 'active';
        break;
      case 'verify':
        data.verificationStatus = 'verified';
        data.verifiedAt = new Date();
        data.verifiedBy = null;
        break;
      case 'unverify':
        data.verificationStatus = 'unverified';
        data.verifiedAt = null;
        break;
    }

    await this.prisma.dealer.update({ where: { id }, data });
    await this.audit.record({
      dealerId: id,
      action: dto.action,
      previousStatus: row.listingStatus,
      newStatus: (data.listingStatus as string) ?? row.listingStatus,
      reason: dto.note ?? null,
    });
    await this.searchProfile.rebuild(id);

    if (notify && row.owner?.email) {
      void this.mailer.sendDealerApprovalStatusEmail(row.owner.email, notify, { note: dto.note }).catch(() => undefined);
    }
    return this.detail(id);
  }

  async removeProduct(dealerId: string, productId: string): Promise<AdminDealerDetail> {
    const product = await this.prisma.dealerProduct.findUnique({ where: { id: productId } });
    if (!product || product.dealerId !== dealerId) {
      throw new NotFoundException('Product not found for this dealer.');
    }
    await this.prisma.dealerProduct.delete({ where: { id: productId } });
    await this.searchProfile.rebuild(dealerId);
    return this.detail(dealerId);
  }

  async updateReport(
    dealerId: string,
    reportId: string,
    dto: UpdateDealerReportDto,
  ): Promise<AdminDealerDetail> {
    const report = await this.prisma.dealerReport.findUnique({ where: { id: reportId } });
    if (!report || report.dealerId !== dealerId) {
      throw new NotFoundException('Report not found for this dealer.');
    }
    await this.prisma.dealerReport.update({
      where: { id: reportId },
      data: { status: dto.status, reviewedAt: new Date(), reviewedBy: null },
    });
    return this.detail(dealerId);
  }

  // Post-visit customer ratings — hide/unhide (brief §39/§40, user instruction
  // 2026-09-11). DealerRatingService owns the aggregate recompute + search
  // index rebuild; this is just the admin-scoped passthrough.
  async setRatingHidden(dealerId: string, ratingId: string, dto: UpdateDealerRatingDto): Promise<AdminDealerDetail> {
    await this.ratings.setHidden(dealerId, ratingId, dto.hidden);
    return this.detail(dealerId);
  }

  // ------------------------------------------------------------------------

  private async loadRow(id: string): Promise<DealerRow> {
    const row = await this.prisma.dealer.findUnique({
      where: { id },
      include: {
        owner: { select: { email: true } },
        subscription: true,
        locations: true,
        products: true,
        _count: { select: { reports: { where: { status: 'open' } } } },
      },
    });
    if (!row || row.deletedAt) throw new NotFoundException('Dealer not found.');
    return row as DealerRow;
  }

  private toListItem(row: DealerRow): AdminDealerListItem {
    const ent = this.entitlement.computeEntitlement(row.subscription);
    const primary = row.locations.find((l) => l.isPrimary) ?? row.locations[0] ?? null;
    const listingStatus = row.listingStatus as DealerListingStatus;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      ownerEmail: row.owner?.email ?? '(unknown)',
      dealerType: row.dealerType as DealerType,
      listingStatus,
      verificationStatus: row.verificationStatus as DealerVerificationStatus,
      subscriptionStatus: ent.status,
      subscriptionActive: ent.active,
      isLiveToCustomers: listingStatus === 'active' && ent.active,
      profileCompleteness: row.profileCompleteness,
      primaryLocality: primary?.locality ?? null,
      openReports: row._count?.reports ?? 0,
      ratingAverage: row.ratingAverage,
      ratingCount: row.ratingCount,
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
    };
  }
}
