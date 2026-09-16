import { Injectable, Logger } from '@nestjs/common';
import type { DealerAuditEntry } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface DealerAuditRecordInput {
  dealerId: string;
  adminId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
}

/**
 * Approval/lifecycle audit trail (admin-approval-before-payment business
 * rule, 2026-09-11, dealer brief §17) — the one writer of `dealer_audit_logs`.
 * Used by DealerPortalService (submit/resubmit), AdminDealersService (every
 * admin decision) and DealerSearchProfileService (payment-triggered
 * activation, adminId null). Recording an entry must never block the state
 * change it documents — `record` swallows its own errors.
 */
@Injectable()
export class DealerAuditService {
  private readonly logger = new Logger(DealerAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: DealerAuditRecordInput): Promise<void> {
    await this.prisma.dealerAuditLog
      .create({
        data: {
          dealerId: entry.dealerId,
          adminId: entry.adminId ?? null,
          action: entry.action,
          previousStatus: entry.previousStatus ?? null,
          newStatus: entry.newStatus ?? null,
          reason: entry.reason ?? null,
        },
      })
      .catch((e) => {
        this.logger.warn(`Could not record audit entry for dealer ${entry.dealerId}: ${String(e)}`);
      });
  }

  async list(dealerId: string): Promise<DealerAuditEntry[]> {
    const rows = await this.prisma.dealerAuditLog.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      action: r.action,
      previousStatus: r.previousStatus,
      newStatus: r.newStatus,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
