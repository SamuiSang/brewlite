import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

describe('OrdersService (Task 6 - Ingredient Inventory & Optimistic Lock)', () => {
  let service: OrdersService;
  let prisma: any;

  const mockIngredientA = {
    id: 'ing-robusta',
    name: 'Hạt cà phê Robusta',
    unit: 'g',
    stock: 1000,
    version: 1,
  };

  const mockIngredientCup = {
    id: 'ing-cup',
    name: 'Ly nhựa',
    unit: 'cái',
    stock: 100,
    version: 1,
  };

  const mockProduct = {
    id: 'prod-cf-den',
    name: 'Cà phê đen đá',
    basePrice: new Prisma.Decimal(25000),
    isActive: true,
    recipeItems: [
      {
        ingredientId: 'ing-robusta',
        amount: 20,
        ingredient: mockIngredientA,
      },
      {
        ingredientId: 'ing-cup',
        amount: 1,
        ingredient: mockIngredientCup,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn<any>(),
        findUnique: jest.fn<any>(),
      },
      ingredient: {
        findUnique: jest.fn<any>(),
        updateMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      topping: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      promotion: {
        findUnique: jest.fn<any>(),
      },
      order: {
        findFirst: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('1. Trừ tồn kho nguyên liệu bằng Optimistic Lock (createOrder)', () => {
    it('khi tạo đơn hàng thành công: kiểm tra trừ nguyên liệu và tăng version bằng Optimistic Lock', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.order.findFirst.mockResolvedValue({ orderCode: '#1042' });
      prisma.ingredient.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'ing-robusta') return Promise.resolve(mockIngredientA);
        if (where.id === 'ing-cup') return Promise.resolve(mockIngredientCup);
        return Promise.resolve(null);
      });
      prisma.ingredient.updateMany.mockResolvedValue({ count: 1 }); // OCC Update thành công

      const createdMockOrder = {
        id: 'ord-123',
        orderCode: '#1043',
        status: 'PENDING',
        totalAmount: 50000,
      };
      prisma.order.create.mockResolvedValue(createdMockOrder);

      const dto = {
        customerName: 'Võ Thành Chiến',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-cf-den',
            size: 'S' as const,
            qty: 2, // 2 ly -> 40g Robusta, 2 ly nhựa
          },
        ],
      };

      const result = await service.createOrder(dto);

      expect(result).toEqual(createdMockOrder);
      // Đảm bảo trừ 40g hạt Robusta kèm Optimistic Lock version
      expect(prisma.ingredient.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'ing-robusta',
          version: 1,
          stock: { gte: 40 },
        },
        data: {
          stock: { decrement: 40 },
          version: { increment: 1 },
        },
      });
      // Đảm bảo trừ 2 ly nhựa kèm version
      expect(prisma.ingredient.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'ing-cup',
          version: 1,
          stock: { gte: 2 },
        },
        data: {
          stock: { decrement: 2 },
          version: { increment: 1 },
        },
      });
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('khi nguyên liệu thô không đủ tồn kho: ném lỗi BadRequestException', async () => {
      const lowStockProduct = {
        ...mockProduct,
        recipeItems: [
          {
            ingredientId: 'ing-robusta',
            amount: 20,
            ingredient: { ...mockIngredientA, stock: 10 }, // Chỉ còn 10g nhưng cần 20g
          },
        ],
      };
      prisma.product.findMany.mockResolvedValue([lowStockProduct]);

      const dto = {
        customerName: 'Võ Thành Chiến',
        phone: '0901234567',
        items: [{ productId: 'prod-cf-den', size: 'S' as const, qty: 1 }],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(BadRequestException);
      await expect(service.createOrder(dto)).rejects.toThrow(/không đủ để pha chế/);
    });

    it('khi có xung đột Optimistic Lock trên nguyên liệu: ném ConflictException', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.ingredient.findUnique.mockResolvedValue(mockIngredientA);
      // Version không khớp (đã bị transaction khác sửa trước) -> updateMany trả về count: 0
      prisma.ingredient.updateMany.mockResolvedValue({ count: 0 });

      const dto = {
        customerName: 'Võ Thành Chiến',
        phone: '0901234567',
        items: [{ productId: 'prod-cf-den', size: 'S' as const, qty: 1 }],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Hoàn trả tồn kho nguyên liệu khi hủy đơn (updateStatus -> CANCELLED)', () => {
    it('khi hủy đơn hàng (CANCELLED): tự động hoàn trả số lượng nguyên liệu thô vào kho', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'PENDING',
        orderItems: [
          {
            productId: 'prod-cf-den',
            qty: 2, // 2 ly cà phê đen -> 40g Robusta, 2 ly nhựa
            product: mockProduct,
          },
        ],
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'CANCELLED',
      });

      await service.updateStatus('ord-1', 'CANCELLED');

      // Phải hoàn trả 40g Robusta vào bảng Ingredient
      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-robusta' },
        data: {
          stock: { increment: 40 },
          version: { increment: 1 },
        },
      });

      // Phải hoàn trả 2 ly nhựa vào bảng Ingredient
      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-cup' },
        data: {
          stock: { increment: 2 },
          version: { increment: 1 },
        },
      });
    });
  });
});
