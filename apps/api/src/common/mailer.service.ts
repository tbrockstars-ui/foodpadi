import { Injectable, Logger } from '@nestjs/common';

/**
 * Placeholder mailer for Phase 1: logs instead of sending. There is no real
 * email provider wired up yet (no SES/Resend/SendGrid account decided), so
 * password-reset "emails" only reach the server log for local development.
 *
 * Must be replaced with a real provider before production — a user who
 * can't receive the reset email can't recover their account.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
    this.logger.warn(
      `[DEV ONLY — no email provider configured] Password reset requested for ${email}. ` +
        `Reset token: ${rawToken} (paste into the app's "Reset password" screen).`,
    );
  }

  /**
   * Food Dealer application decision notification (admin-approval-before-
   * payment business rule, 2026-09-11, dealer brief §7/§15). Same "log
   * instead of send" posture as the reset email above — there is still no
   * real provider wired up. Fire-and-forget from the caller; never throws.
   */
  async sendDealerApprovalStatusEmail(
    email: string,
    status: 'approved' | 'changes_requested' | 'rejected',
    opts: { note?: string | null } = {},
  ): Promise<void> {
    const subject =
      status === 'approved'
        ? '🎉 Your FoodPadi Food Dealer application has been approved'
        : status === 'changes_requested'
          ? 'Action required on your FoodPadi Food Dealer application'
          : 'Update on your FoodPadi Food Dealer application';
    const body =
      status === 'approved'
        ? 'Great news — FoodPadi has approved your Food Dealer application. The next step is to choose your subscription; your listing goes live once it is active. No payment has been taken.'
        : status === 'changes_requested'
          ? `Please update your application before we can approve it.${opts.note ? ` Admin note: ${opts.note}` : ''}`
          : `Your application was not approved.${opts.note ? ` Reason: ${opts.note}` : ''}`;
    this.logger.warn(
      `[DEV ONLY — no email provider configured] "${subject}" → ${email}. ${body}`,
    );
  }
}
