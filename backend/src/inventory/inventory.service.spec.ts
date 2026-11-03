import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';
import { UnitConverter } from './unit-converter';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ingredient: {
        findMany: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      stockReceipt: {
        count: jest.fn<any>().mockResolvedValue(0),
        create: jest.fn<any>(),
      },
      stockReceiptItem: {
        create: jest.fn<any>(),
      },
      inventoryTransaction: {
        create: jest.fn<any>(),
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      product: {
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      productRecipe: {
        findMany: jest.fn<any>(),
        deleteMany: jest.fn<any>(),
        create: jest.fn<any>(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAllIngredients', () => {
    it('tính toán đúng trạng thái LOW_STOCK khi tồn kho dưới định mức tối thiểu', async () => {
      prisma.ingredient.findMany.mockResolvedValue([
        {
          id: 'ing-1',
          name: 'Cà phê Robusta',
          unit: 'g',
          currentStock: new Prisma.Decimal(50),
          minimumStock: new Prisma.Decimal(100),
          costPerUnit: new Prisma.Decimal(250),
          _count: { recipes: 3 },
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findAllIngredients();
      expect(result[0].status).toBe('LOW_STOCK');
      expect(result[0].warning).toContain('dưới định mức tối thiểu');
      expect(result[0].recipesCount).toBe(3);
    });

    it('tính toán đúng trạng thái OUT_OF_STOCK khi tồn kho bằng 0', async () => {
      prisma.ingredient.findMany.mockResolvedValue([
        {
          id: 'ing-2',
          name: 'Sữa tươi',
          unit: 'ml',
          currentStock: new Prisma.Decimal(0),
          minimumStock: new Prisma.Decimal(1000),
          costPerUnit: new Prisma.Decimal(35),
          _count: { recipes: 1 },
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findAllIngredients();
      expect(result[0].status).toBe('OUT_OF_STOCK');
      expect(result[0].warning).toBe('Đã hết hàng');
    });
  });

  describe('UnitConverter & Quy đổi đơn vị trong Nhập kho (createStockReceipt)', () => {
    it('quy đổi chính xác đơn vị khối lượng kg -> g', () => {
      const converted = UnitConverter.convert(2.5, 'kg', 'g');
      expect(converted).toBe(2500);
    });

    it('quy đổi chính xác đơn vị thể tích lít -> ml', () => {
      const converted = UnitConverter.convert(3, 'lít', 'ml');
      expect(converted).toBe(3000);
    });

    it('từ chối quy đổi giữa hai hệ đơn vị không tương thích (kg -> ml)', () => {
      expect(() => UnitConverter.convert(1, 'kg', 'ml')).toThrow(BadRequestException);
    });

    it('nhập kho bằng đơn vị kg tự động quy đổi thành g và cập nhật tồn kho & đơn giá', async () => {
      prisma.stockReceipt.create.mockResolvedValue({
        id: 'rec-1',
        receiptCode: 'PNK-TEST-001',
      });
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'Hạt cà phê Robusta',
        unit: 'g',
        currentStock: new Prisma.Decimal(1000),
        costPerUnit: new Prisma.Decimal(250),
      });

      // Nhập 2 kg với đơn giá 200,000đ/kg
      const dto = {
        receiptCode: 'PNK-TEST-001',
        items: [
          {
            ingredientId: 'ing-1',
            quantity: 2,
            unit: 'kg',
            unitCost: 200000,
          },
        ],
      };

      const result = await service.createStockReceipt(dto);
      expect(result.message).toContain('thành công');

      // Tồn kho mới = 1000g + 2000g = 3000g
      // Đơn giá mới = 200,000 / 1000 = 200đ/g
      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-1' },
        data: {
          currentStock: 3000,
          costPerUnit: 200,
        },
      });

      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'RECEIPT',
          quantity: 2000,
          balanceAfter: 3000,
        }),
      });
    });
  });

  describe('adjustStock', () => {
    it('ngăn chặn điều chỉnh tồn kho âm', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'Cà phê',
        unit: 'g',
        currentStock: new Prisma.Decimal(20),
      });

      await expect(
        service.adjustStock('ing-1', {
          quantityChange: -50,
          reason: 'Hao hụt',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cho phép điều chỉnh hợp lệ và tạo bản ghi InventoryTransaction', async () => {
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'Cà phê',
        unit: 'g',
        currentStock: new Prisma.Decimal(100),
      });
      prisma.ingredient.update.mockResolvedValue({
        id: 'ing-1',
        name: 'Cà phê',
        unit: 'g',
        currentStock: 120,
      });

      const result = await service.adjustStock('ing-1', {
        quantityChange: 20,
        reason: 'Kiểm kê thừa',
      });

      expect(result.message).toContain('thành công');
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'ADJUSTMENT',
          quantity: 20,
          balanceAfter: 120,
        }),
      });
    });
  });

  describe('Công thức sản phẩm (BOM) & Tính giá vốn (COGS)', () => {
    it('setProductRecipe: lưu công thức và tính toán giá vốn COGS tự động', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-cf-sua',
        name: 'Cà phê sữa đá',
      });

      // Mock nguyên liệu: Cà phê (100đ/g), Sữa đặc (33.33đ/ml), Ly (500đ/cái)
      prisma.ingredient.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'ing-cf') return Promise.resolve({ id: 'ing-cf', costPerUnit: new Prisma.Decimal(100) });
        if (where.id === 'ing-sua') return Promise.resolve({ id: 'ing-sua', costPerUnit: new Prisma.Decimal(33.33) });
        if (where.id === 'ing-ly') return Promise.resolve({ id: 'ing-ly', costPerUnit: new Prisma.Decimal(500) });
        return Promise.resolve(null);
      });

      // Công thức Cà phê sữa: 20g cà phê + 30ml sữa đặc + 1 cái ly
      // Giá vốn dự kiến = 20 * 100 (2000đ) + 30 * 33.33 (1000đ) + 1 * 500 (500đ) = 3500đ
      const dto = {
        productId: 'prod-cf-sua',
        recipes: [
          { ingredientId: 'ing-cf', size: 'M' as const, amount: 20, wasteRate: 0 },
          { ingredientId: 'ing-sua', size: 'M' as const, amount: 30, wasteRate: 0 },
          { ingredientId: 'ing-ly', size: 'M' as const, amount: 1, wasteRate: 0 },
        ],
      };

      const result = await service.setProductRecipe(dto);

      expect(result.message).toContain('thành công');
      expect(result.costPrice).toBe(3500);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-cf-sua' },
        data: { costPrice: 3500 },
      });
    });

    it('copyProductRecipe: sao chép toàn bộ công thức từ sản phẩm nguồn sang sản phẩm đích', async () => {
      prisma.product.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'prod-target') return Promise.resolve({ id: 'prod-target', name: 'Cà phê nâu đá' });
        if (where.id === 'prod-source') {
          return Promise.resolve({
            id: 'prod-source',
            name: 'Cà phê sữa đá',
            costPrice: new Prisma.Decimal(3500),
            recipes: [
              { ingredientId: 'ing-cf', size: 'M', amount: new Prisma.Decimal(20), wasteRate: new Prisma.Decimal(0) },
              { ingredientId: 'ing-sua', size: 'M', amount: new Prisma.Decimal(30), wasteRate: new Prisma.Decimal(0) },
            ],
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.copyProductRecipe('prod-target', 'prod-source');

      expect(result.copiedItemsCount).toBe(2);
      expect(prisma.productRecipe.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-target' } });
      expect(prisma.productRecipe.create).toHaveBeenCalledTimes(2);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-target' },
        data: { costPrice: new Prisma.Decimal(3500) },
      });
    });
  });

  describe('calculateProductAvailability', () => {
    it('tính toán số ly tối đa dựa trên điểm nghẽn nguyên liệu', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Cà phê đen',
      });

      // 1 ly cần: 25g cà phê và 1 cái ly
      // Cà phê có 100g (được 4 ly)
      // Ly chỉ có 2 cái (được 2 ly) -> Điểm nghẽn là 2 ly
      prisma.productRecipe.findMany.mockResolvedValue([
        {
          productId: 'prod-1',
          size: 'M',
          amount: new Prisma.Decimal(25),
          wasteRate: new Prisma.Decimal(0),
          ingredient: {
            name: 'Cà phê',
            unit: 'g',
            currentStock: new Prisma.Decimal(100),
          },
        },
        {
          productId: 'prod-1',
          size: 'M',
          amount: new Prisma.Decimal(1),
          wasteRate: new Prisma.Decimal(0),
          ingredient: {
            name: 'Ly',
            unit: 'piece',
            currentStock: new Prisma.Decimal(2),
          },
        },
      ]);

      const result = await service.calculateProductAvailability('prod-1', 'M');
      expect(result.maxCups).toBe(2);
      expect(result.ingredientsDetail?.length).toBe(2);
    });
  });
});
