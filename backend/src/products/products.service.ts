import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withAvailability } from './recipe';

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
        recipeIngredients: { include: { ingredient: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return products.map(withAvailability);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        recipeIngredients: { include: { ingredient: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return withAvailability(product);
  }
}
