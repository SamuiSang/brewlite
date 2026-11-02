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
   * Tự tính số ly tối đa pha được từ nguyên liệu tồn kho hiện tại (Task 2 - Chiến)
   * stock = min(floor(Ingredient.stock / RecipeItem.amount))
   */
  private calculateDynamicStock(product: any): number {
    if (!product.recipeItems || product.recipeItems.length === 0) {
      return product.stock ?? 0;
    }

    const possibleCupsPerIngredient = product.recipeItems.map((r: any) => {
      const ingStock = r.ingredient ? r.ingredient.stock : 0;
      const amountNeeded = r.amount;
      if (amountNeeded <= 0) return 999999;
      return Math.floor(ingStock / amountNeeded);
    });

    return Math.max(0, Math.min(...possibleCupsPerIngredient));
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
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return products.map((p) => ({
      ...p,
      stock: this.calculateDynamicStock(p),
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        recipeItems: {
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
      stock: this.calculateDynamicStock(product),
    };
  }
}
