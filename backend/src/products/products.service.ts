import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getToppings() {
    return this.prisma.topping.findMany({
      where: { isAvailable: true },
    });
  }

  /**
   * Tính số ly tối đa có thể pha chế từ nguyên liệu thô hiện tại (BOM Dynamic Stock)
   */
  private calculateDynamicStock(
    recipes: Array<{
      size: string | null;
      amount: any;
      wasteRate: any;
      ingredient: { currentStock: any };
    }>,
  ): number {
    if (!recipes || recipes.length === 0) {
      return 0;
    }

    // Ưu tiên kiểm tra theo Size S (hoặc công thức chung size = null), fallback sang M/L nếu chưa có S
    const sizePriority = ['S', 'M', 'L'];
    let targetRecipes = recipes.filter((r) => r.size === 'S' || r.size === null);
    if (targetRecipes.length === 0) {
      for (const s of sizePriority) {
        const matched = recipes.filter((r) => r.size === s || r.size === null);
        if (matched.length > 0) {
          targetRecipes = matched;
          break;
        }
      }
    }
    if (targetRecipes.length === 0) {
      targetRecipes = recipes;
    }

    let minCups = Infinity;
    for (const r of targetRecipes) {
      const amount = Number(r.amount);
      const wasteRate = Number(r.wasteRate || 0);
      const effectivePerCup = amount * (1 + wasteRate / 100);
      if (effectivePerCup <= 0) continue;

      const currentStock = Number(r.ingredient?.currentStock ?? 0);
      const possible = Math.floor(currentStock / effectivePerCup);
      if (possible < minCups) {
        minCups = possible;
      }
    }

    return minCups === Infinity ? 0 : Math.max(0, minCups);
  }

  async findAll(categoryId?: string, search?: string) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        recipes: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return products.map((product) => ({
      ...product,
      stock: this.calculateDynamicStock(product.recipes),
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        recipes: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return {
      ...product,
      stock: this.calculateDynamicStock(product.recipes),
    };
  }
}
