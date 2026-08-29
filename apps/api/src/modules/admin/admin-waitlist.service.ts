import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListWaitlistQueryDto } from './dto/list-waitlist-query.dto';

const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class AdminWaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWaitlistQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = query.search
      ? { email: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [signups, total] = await Promise.all([
      this.prisma.waitlistSignup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.waitlistSignup.count({ where }),
    ]);

    return {
      signups: signups.map((s) => ({ id: s.id, email: s.email, createdAt: s.createdAt.toISOString() })),
      page,
      pageSize,
      total,
    };
  }
}
