// One-off CLI to create (or reset the password of) an admin console staff
// account. There is no self-service signup or in-app staff management yet —
// this script is how the first (and any additional) admin_staff_users row
// gets created. Run from apps/api:
//
//   npx ts-node scripts/create-admin-staff-user.ts <username> <password> ["Display Name"]
//
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BCRYPT_ROUNDS = 12; // matches apps/api/src/modules/auth/auth.service.ts

async function main() {
  const [username, password, displayName] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npx ts-node scripts/create-admin-staff-user.ts <username> <password> ["Display Name"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const staffUser = await prisma.adminStaffUser.upsert({
      where: { username },
      create: { username, passwordHash, displayName: displayName ?? null },
      update: { passwordHash, displayName: displayName ?? null },
    });
    console.log(`OK: admin staff user "${staffUser.username}" is ready to sign in at /admin/login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
