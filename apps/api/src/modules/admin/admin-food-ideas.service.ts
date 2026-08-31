import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFoodIdeaDto } from './dto/create-food-idea.dto';
import { ListFoodIdeasQueryDto } from './dto/list-food-ideas-query.dto';
import { UpdateFoodIdeaDto } from './dto/update-food-idea.dto';

const DEFAULT_PAGE_SIZE = 50;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Eat Now's catalog (docs/IMPLEMENTATION_PLAN.md Phase 4) — used to be a
 * hardcoded array requiring a code deploy to change a single dish; this is
 * the admin CRUD for the `FoodIdea` table that replaced it. EatNowService
 * reads the same table directly (isActive: true rows only) — nothing here
 * duplicates its matching logic, this only manages the underlying data.
 */
@Injectable()
export class AdminFoodIdeasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListFoodIdeasQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = {
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { cuisine: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive === 'true' } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.foodIdea.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.foodIdea.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async detail(id: string) {
    const idea = await this.prisma.foodIdea.findUnique({ where: { id } });
    if (!idea) {
      throw new NotFoundException('Food idea not found.');
    }
    return idea;
  }

  async create(dto: CreateFoodIdeaDto) {
    const slug = dto.slug || slugify(dto.title);
    const existing = await this.prisma.foodIdea.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A food idea with slug "${slug}" already exists.`);
    }

    return this.prisma.foodIdea.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        cuisine: dto.cuisine,
        budgetTier: dto.budgetTier,
        tags: dto.tags,
      },
    });
  }

  async update(id: string, dto: UpdateFoodIdeaDto) {
    const existing = await this.prisma.foodIdea.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Food idea not found.');
    }

    return this.prisma.foodIdea.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.cuisine !== undefined ? { cuisine: dto.cuisine } : {}),
        ...(dto.budgetTier !== undefined ? { budgetTier: dto.budgetTier } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /** Real, hard deletion — for a genuine mistake entry. Toggling `isActive`
   * (via update()) is the everyday "remove from search results" action; this
   * is for actually erasing a row, matching the Users admin precedent of
   * offering both a reversible suspend and a real delete. */
  async delete(id: string) {
    const existing = await this.prisma.foodIdea.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Food idea not found.');
    }
    await this.prisma.foodIdea.delete({ where: { id } });
  }
}
