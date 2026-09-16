import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../billing/entitlement.service';

function build(profile: any = { displayName: null, countryCode: null }) {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com', profile }),
    },
    userProfile: {
      update: jest.fn(({ data }: any) => {
        Object.assign(profile, data);
        return Promise.resolve(profile);
      }),
    },
  };
  const entitlements = { getUserEntitlement: jest.fn().mockResolvedValue('trial') };
  return {
    svc: new UsersService(
      prisma as unknown as PrismaService,
      entitlements as unknown as EntitlementService,
    ),
    prisma,
    profile,
  };
}

describe('UsersService.getProfile', () => {
  it('includes countryCode', async () => {
    const { svc } = build({ displayName: 'Ada', countryCode: 'NG' });
    await expect(svc.getProfile('u1')).resolves.toMatchObject({ countryCode: 'NG', displayName: 'Ada' });
  });

  it('countryCode is null when unset', async () => {
    const { svc } = build();
    await expect(svc.getProfile('u1')).resolves.toMatchObject({ countryCode: null });
  });
});

describe('UsersService.updateProfile', () => {
  it('normalises and stores a 2-letter country code', async () => {
    const { svc, prisma } = build();
    await svc.updateProfile('u1', { countryCode: 'gb' });
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { countryCode: 'GB' },
    });
  });

  it('rejects a non-ISO country code', async () => {
    const { svc } = build();
    await expect(svc.updateProfile('u1', { countryCode: 'Nigeria' })).rejects.toThrow(BadRequestException);
  });

  it('is a no-op (still returns the profile) when nothing is passed', async () => {
    const { svc, prisma } = build({ displayName: 'X', countryCode: 'US' });
    await expect(svc.updateProfile('u1', {})).resolves.toMatchObject({ countryCode: 'US' });
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
  });
});

describe('UsersService — birth-month avatar picker (user instruction 2026-09-11)', () => {
  it('accepts a valid avatarId and birthMonth', async () => {
    const { svc, prisma } = build();
    const res = await svc.updateProfile('u1', { birthMonth: 6, avatarId: '6-bold' });
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { birthMonth: 6, avatarId: '6-bold' },
    });
    expect(res).toMatchObject({ birthMonth: 6, avatarId: '6-bold' });
  });

  it('lets you pick an avatar from a month other than your own birth month', async () => {
    const { svc } = build();
    await expect(svc.updateProfile('u1', { birthMonth: 3, avatarId: '11-dark' })).resolves.toMatchObject({
      birthMonth: 3,
      avatarId: '11-dark',
    });
  });

  it('rejects a malformed or out-of-range avatarId', async () => {
    const { svc } = build();
    await expect(svc.updateProfile('u1', { avatarId: '13-bold' })).rejects.toThrow(BadRequestException);
    await expect(svc.updateProfile('u1', { avatarId: '6-neon' })).rejects.toThrow(BadRequestException);
    await expect(svc.updateProfile('u1', { avatarId: 'not-an-id' })).rejects.toThrow(BadRequestException);
  });

  it('null clears both fields', async () => {
    const { svc, prisma } = build({ birthMonth: 6, avatarId: '6-bold' });
    await svc.updateProfile('u1', { birthMonth: null, avatarId: null });
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { birthMonth: null, avatarId: null },
    });
  });

  it('getProfile reports null when never set', async () => {
    const { svc } = build();
    await expect(svc.getProfile('u1')).resolves.toMatchObject({ birthMonth: null, avatarId: null });
  });
});
