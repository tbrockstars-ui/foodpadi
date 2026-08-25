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
}
