import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type RecipeRow = {
  ingredientId: string;
  size: string;
  quantity: Prisma.Decimal;
  ingredient: {
    id: string;
    name: string;
    unit: string;
    stock: Prisma.Decimal;
    version: number;
  };
};

export function recipeForSize(rows: RecipeRow[], size: string): RecipeRow[] {
  const recipe = rows.filter((row) => row.size === size);
  if (
    !recipe.length ||
    recipe.some((row) => !row.quantity.isFinite() || row.quantity.lte(0))
  ) {
    throw new BadRequestException(`Chưa có công thức hợp lệ cho size ${size}`);
  }
  return recipe;
}

export function availableQuantity(rows: RecipeRow[], size: string): number {
  const recipe = rows.filter((row) => row.size === size);
  if (
    !recipe.length ||
    recipe.some((row) => !row.quantity.isFinite() || row.quantity.lte(0))
  )
    return 0;
  return Math.max(
    0,
    Math.min(
      ...recipe.map((row) =>
        row.ingredient.stock.div(row.quantity).floor().toNumber(),
      ),
    ),
  );
}

export function withAvailability<T extends { recipeIngredients: RecipeRow[] }>(
  product: T,
) {
  const { recipeIngredients, ...data } = product;
  const stockBySize = {
    S: availableQuantity(recipeIngredients, 'S'),
    M: availableQuantity(recipeIngredients, 'M'),
    L: availableQuantity(recipeIngredients, 'L'),
  };
  return { ...data, stock: stockBySize.S, stockBySize };
}

export function requiredIngredients(
  items: { productId: string; size: string; qty: number }[],
  products: Map<string, { name: string; recipeIngredients: RecipeRow[] }>,
) {
  const required = new Map<
    string,
    { ingredient: RecipeRow['ingredient']; quantity: Prisma.Decimal }
  >();
  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
      throw new BadRequestException('Số lượng phải là số nguyên dương');
    }
    const product = products.get(item.productId)!;
    for (const row of recipeForSize(product.recipeIngredients, item.size)) {
      const previous = required.get(row.ingredientId);
      required.set(row.ingredientId, {
        ingredient: row.ingredient,
        quantity: (previous?.quantity ?? new Prisma.Decimal(0)).plus(
          row.quantity.mul(item.qty),
        ),
      });
    }
  }
  for (const { ingredient, quantity } of required.values()) {
    if (ingredient.stock.lessThan(quantity)) {
      throw new BadRequestException(
        `Không đủ nguyên liệu "${ingredient.name}": cần ${quantity} ${ingredient.unit}, còn ${ingredient.stock} ${ingredient.unit}`,
      );
    }
  }
  return required;
}
