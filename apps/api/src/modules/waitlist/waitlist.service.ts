import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent by design — re-submitting the same email (e.g. a double
   * click, or someone who forgot they'd already signed up) succeeds quietly
   * rather than surfacing a "you're already on the list" error.
   */
  async join(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.prisma.waitlistSignup.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail },
      update: {},
    });
  }
}
