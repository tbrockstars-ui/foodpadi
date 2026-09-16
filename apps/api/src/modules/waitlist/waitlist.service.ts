import { Injectable } from '@nestjs/common';
import { MARKETING_CONSENT_VERSION } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface JoinWaitlistOptions {
  marketingConsent: boolean;
  purpose?: 'general' | 'ios_waitlist';
  source?: string;
  campaign?: string;
}

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent by design — re-submitting the same email (e.g. a double
   * click, or someone who forgot they'd already signed up) succeeds quietly
   * rather than surfacing a "you're already on the list" error.
   *
   * marketingConsent and purpose only ever move toward "more specific"
   * (false -> true, general -> ios_waitlist), never back: the form's
   * checkbox is unticked by default on every fresh page load, and a generic
   * re-signup shouldn't erase that someone specifically wanted the iOS
   * waitlist. Revoking consent is a separate, explicit action (unsubscribe),
   * not an implicit side effect of joining again.
   *
   * source/campaign are first-touch only — set on first signup, never
   * overwritten by a later visit with different (or no) attribution params.
   */
  async join(email: string, options: JoinWaitlistOptions): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const consentFields = options.marketingConsent
      ? {
          marketingConsent: true,
          marketingConsentVersion: MARKETING_CONSENT_VERSION,
          marketingConsentAt: new Date(),
        }
      : {};
    const purposeField = options.purpose === 'ios_waitlist' ? { purpose: 'ios_waitlist' } : {};
    const attributionFields = {
      ...(options.source ? { source: options.source } : {}),
      ...(options.campaign ? { campaign: options.campaign } : {}),
    };
    await this.prisma.waitlistSignup.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, ...consentFields, ...purposeField, ...attributionFields },
      update: { ...consentFields, ...purposeField },
    });
  }
}
