import { Prisma } from '@prisma/client';
import { availableQuantity, requiredIngredients, RecipeRow } from './recipe';

const row = (
  id: string,
  stock: number,
  quantity: number,
  size = 'S',
): RecipeRow => ({
  ingredientId: id,
  size,
  quantity: new Prisma.Decimal(quantity),
  ingredient: {
    id,
    name: id,
    unit: 'g',
    stock: new Prisma.Decimal(stock),
    version: 1,
  },
});

describe('Recipe inventory', () => {
  it('100g / 10g permits 10 cups, rejects cup 11', () => {
    const recipeIngredients = [row('coffee', 100, 10)];
    const products = new Map([
      ['coffee', { name: 'Coffee', recipeIngredients }],
    ]);
    expect(availableQuantity(recipeIngredients, 'S')).toBe(10);
    expect(
      requiredIngredients(
        [{ productId: 'coffee', size: 'S', qty: 10 }],
        products,
      )
        .get('coffee')!
        .quantity.toNumber(),
    ).toBe(100);
    expect(() =>
      requiredIngredients(
        [{ productId: 'coffee', size: 'S', qty: 11 }],
        products,
      ),
    ).toThrow(/cần 110 g, còn 100 g/);
  });

  it('uses limiting ingredient, floors decimals and separates sizes', () => {
    const recipe = [
      row('coffee', 100, 10),
      row('milk', 49, 10),
      row('coffee', 100, 15, 'L'),
    ];
    expect(availableQuantity(recipe, 'S')).toBe(4);
    expect(availableQuantity(recipe, 'L')).toBe(6);
    expect(availableQuantity([row('coffee', 1, 0.1)], 'S')).toBe(10);
    expect(availableQuantity(recipe, 'M')).toBe(0);
    expect(availableQuantity([row('coffee', 100, 0)], 'S')).toBe(0);
  });

  it('aggregates shared ingredients across products and sizes', () => {
    const products = new Map([
      ['black', { name: 'Black', recipeIngredients: [row('coffee', 100, 10)] }],
      [
        'milk',
        { name: 'Milk', recipeIngredients: [row('coffee', 100, 15, 'L')] },
      ],
    ]);
    expect(() =>
      requiredIngredients(
        [
          { productId: 'black', size: 'S', qty: 5 },
          { productId: 'milk', size: 'L', qty: 4 },
        ],
        products,
      ),
    ).toThrow(/cần 110/);
    expect(() =>
      requiredIngredients(
        [{ productId: 'black', size: 'M', qty: 1 }],
        products,
      ),
    ).toThrow(/Chưa có công thức/);
    expect(() =>
      requiredIngredients(
        [{ productId: 'black', size: 'S', qty: -1 }],
        products,
      ),
    ).toThrow(/số nguyên dương/);
  });
});
