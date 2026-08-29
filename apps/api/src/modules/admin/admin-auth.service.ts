import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: AdminLoginDto) {
    const staffUser = await this.prisma.adminStaffUser.findUnique({
      where: { username: dto.username },
    });
    // Same error either way — don't reveal whether the username exists.
    if (!staffUser || !(await bcrypt.compare(dto.password, staffUser.passwordHash))) {
      throw new UnauthorizedException('Incorrect username or password.');
    }

    await this.prisma.adminStaffUser.update({
      where: { id: staffUser.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: staffUser.id,
      username: staffUser.username,
      displayName: staffUser.displayName,
    };
  }
}
