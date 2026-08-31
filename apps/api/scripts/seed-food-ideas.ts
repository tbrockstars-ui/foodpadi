// One-time migration of the old hardcoded EAT_NOW_CATALOG array into the
// `FoodIdea` DB table (admin/food-ideas manages it from here on). Idempotent
// — upserts by `slug` (the dish's original `id`, e.g. "shawarma-wrap"), so
// re-running it is safe and won't duplicate rows. Run from apps/api:
//
//   npx ts-node scripts/seed-food-ideas.ts
//
import { PrismaClient } from '@prisma/client';
import { EAT_NOW_CATALOG } from '../src/modules/eat-now/eat-now-catalog';

async function main() {
  const prisma = new PrismaClient();
  try {
    let created = 0;
    let updated = 0;
    for (const idea of EAT_NOW_CATALOG) {
      const existing = await prisma.foodIdea.findUnique({ where: { slug: idea.id } });
      await prisma.foodIdea.upsert({
        where: { slug: idea.id },
        create: {
          slug: idea.id,
          title: idea.title,
          description: idea.description,
          cuisine: idea.cuisine,
          budgetTier: idea.budgetTier,
          tags: idea.tags,
        },
        update: {
          title: idea.title,
          description: idea.description,
          cuisine: idea.cuisine,
          budgetTier: idea.budgetTier,
          tags: idea.tags,
        },
      });
      if (existing) updated++;
      else created++;
    }
    console.log(`OK: ${created} food idea(s) created, ${updated} updated (${EAT_NOW_CATALOG.length} total).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
