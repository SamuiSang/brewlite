import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

describe('OrdersService (Task 10 - Optimistic Lock, Voucher, Loyalty, State Machine, Inventory BOM)', () => {
  let service: OrdersService;
  let prisma: any;

  const mockProductA = {
    id: 'prod-1',
    name: 'Cà phê Muối',
    basePrice: new Prisma.Decimal(35000),
    stock: 10,
    version: 1,
    isActive: true,
  };

  const mockUser = {
    id: 'user-1',
    email: 'quang@brewlite.vn',
    loyaltyPoints: 50,
  };

  const mockPromotionPercent = {
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: new Prisma.Decimal(10),
    minOrderAmount: new Prisma.Decimal(40000),
    maxDiscountAmount: new Prisma.Decimal(20000),
    validUntil: new Date(Date.now() + 86400000),
    isActive: true,
  };

  const mockPromotionFixed = {
    code: 'GIAM20K',
    discountType: 'FIXED_AMOUNT',
    discountValue: new Prisma.Decimal(20000),
    minOrderAmount: new Prisma.Decimal(60000),
    maxDiscountAmount: new Prisma.Decimal(20000),
    validUntil: new Date(Date.now() + 86400000),
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn<any>(),
        updateMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      productRecipe: {
        findMany: jest.fn<any>().mockResolvedValue([
          {
            id: 'rec-1',
            productId: 'prod-1',
            ingredientId: 'ing-1',
            size: 'S',
            amount: new Prisma.Decimal(20),
            wasteRate: new Prisma.Decimal(0),
            ingredient: {
              id: 'ing-1',
              name: 'Hạt cà phê',
              unit: 'g',
              currentStock: new Prisma.Decimal(1000),
            },
          },
        ]),
        create: jest.fn<any>(),
        deleteMany: jest.fn<any>(),
      },
      ingredient: {
        findUnique: jest.fn<any>().mockResolvedValue({
          id: 'ing-1',
          name: 'Hạt cà phê',
          unit: 'g',
          currentStock: new Prisma.Decimal(1000),
        }),
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      inventoryTransaction: {
        create: jest.fn<any>(),
        findMany: jest.fn<any>().mockResolvedValue([]),
        count: jest.fn<any>().mockResolvedValue(0),
      },
      orderStatusHistory: {
        create: jest.fn<any>(),
      },
      topping: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      promotion: {
        findUnique: jest.fn<any>(),
      },
      user: {
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
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

  describe('1. Khóa tồn kho đồng thời (Optimistic Lock version)', () => {
    it('khi tạo đơn hàng thành công: kiểm tra trừ tồn kho và tăng version bằng Optimistic Lock', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.order.findFirst.mockResolvedValue({ orderCode: '#1042' });
      prisma.product.updateMany.mockResolvedValue({ count: 1 }); // OCC Update thành công

      const createdMockOrder = {
        id: 'ord-123',
        orderCode: '#1043',
        status: 'PENDING',
        totalAmount: 35000,
      };
      prisma.order.create.mockResolvedValue(createdMockOrder);

      const dto = {
        customerName: 'Nguyễn Văn Quang',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-1',
            size: 'S' as const,
            qty: 2,
          },
        ],
      };

      const result = await service.createOrder(dto);

      expect(result).toEqual(createdMockOrder);
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'prod-1',
          version: 1,
        },
        data: {
          version: { increment: 1 },
        },
      });
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('khi số lượng đặt thiếu nguyên liệu theo công thức BOM: ném lỗi BadRequestException', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.productRecipe.findMany.mockResolvedValue([
        {
          productId: 'prod-1',
          ingredientId: 'ing-1',
          amount: new Prisma.Decimal(25),
          ingredient: { id: 'ing-1', name: 'Cà phê Robusta', unit: 'g' },
        },
      ]);
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'Cà phê Robusta',
        unit: 'g',
        currentStock: new Prisma.Decimal(10),
      });

      const dto = {
        customerName: 'Nguyễn Văn Quang',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-1',
            size: 'S' as const,
            qty: 5,
          },
        ],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        /Không đủ nguyên liệu để pha chế/,
      );
    });

    it('khi xảy ra xung đột Optimistic Lock (version bị thay đổi bởi transaction khác): ném ConflictException sau khi thử lại', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.order.findFirst.mockResolvedValue({ orderCode: '#1042' });
      prisma.product.updateMany.mockResolvedValue({ count: 0 });

      const dto = {
        customerName: 'Nguyễn Văn Quang',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-1',
            size: 'S' as const,
            qty: 1,
          },
        ],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('2. Kiểm tra định mức nguyên liệu công thức món (BOM - Bill of Materials)', () => {
    it('từ chối đặt hàng và báo rõ nguyên liệu thiếu khi tồn kho nguyên liệu không đủ', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      // Mock công thức: 1 ly cần 25g Cà phê hạt
      prisma.productRecipe.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          productId: 'prod-1',
          ingredientId: 'ing-1',
          size: 'S',
          amount: new Prisma.Decimal(25),
          ingredient: {
            id: 'ing-1',
            name: 'Cà phê Robusta',
            unit: 'g',
            currentStock: new Prisma.Decimal(10), // Chỉ còn 10g nhưng cần 50g cho 2 ly
          },
        },
      ]);

      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'Cà phê Robusta',
        unit: 'g',
        currentStock: new Prisma.Decimal(10),
      });

      const dto = {
        customerName: 'Nguyễn Văn Quang',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-1',
            size: 'S' as const,
            qty: 2, // Cần 50g
          },
        ],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        /Không đủ nguyên liệu để pha chế: Cà phê Robusta/,
      );
    });
  });

  describe('3. Voucher / Promotion Calculation', () => {
    it('tính giảm giá theo % kèm trần maxDiscountAmount chính xác', () => {
      const discount = service.calculatePromotionDiscount(
        mockPromotionPercent,
        300000,
      );
      expect(discount).toBe(20000);
    });

    it('tính giảm giá số tiền cố định (FIXED_AMOUNT)', () => {
      const discount = service.calculatePromotionDiscount(
        mockPromotionFixed,
        100000,
      );
      expect(discount).toBe(20000);
    });

    it('ném lỗi khi đơn hàng chưa đạt giá trị tối thiểu (minOrderAmount)', () => {
      expect(() =>
        service.calculatePromotionDiscount(mockPromotionFixed, 50000),
      ).toThrow(BadRequestException);
    });

    it('ném lỗi khi voucher đã hết hạn sử dụng', () => {
      const expiredPromo = {
        ...mockPromotionPercent,
        validUntil: new Date(Date.now() - 86400000),
      };

      expect(() =>
        service.calculatePromotionDiscount(expiredPromo, 100000),
      ).toThrow(BadRequestException);
    });

    it('validateVoucher API trả về đúng kết quả tính toán chi tiết', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockPromotionPercent);

      const result = await service.validateVoucher({
        code: 'WELCOME10',
        subtotal: 100000,
      });

      expect(result.code).toBe('WELCOME10');
      expect(result.discountAmount).toBe(10000);
      expect(result.finalAmount).toBe(90000);
    });
  });

  describe('4. Loyalty Points (Tích điểm & Tiêu điểm)', () => {
    it('cho phép dùng điểm tích lũy để giảm giá khi đặt hàng', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findFirst.mockResolvedValue({ orderCode: '#1042' });

      let capturedOrderData: any;
      prisma.order.create.mockImplementation((args: any) => {
        capturedOrderData = args.data;
        return { id: 'ord-loyalty', ...args.data };
      });

      const dto = {
        userId: 'user-1',
        customerName: 'Quang',
        phone: '0901234567',
        useLoyaltyPoints: 10,
        items: [{ productId: 'prod-1', size: 'S' as const, qty: 1 }],
      };

      await service.createOrder(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { decrement: 10 } },
      });
      expect(capturedOrderData.discountAmount).toBe(10000);
      expect(capturedOrderData.totalAmount).toBe(25000);
    });

    it('từ chối khi tài khoản không đủ số điểm yêu cầu', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, loyaltyPoints: 5 });

      const dto = {
        userId: 'user-1',
        customerName: 'Quang',
        phone: '0901234567',
        useLoyaltyPoints: 20,
        items: [{ productId: 'prod-1', size: 'S' as const, qty: 1 }],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('5. Máy trạng thái đơn hàng (Order State Machine) & Hoàn tồn kho trong updateStatus', () => {
    it('chuyển trạng thái hợp lệ: PENDING -> PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'PENDING',
        orderItems: [],
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'PAID',
      });

      const updated = await service.updateStatus('ord-1', 'PAID');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: { status: 'PAID' },
        }),
      );
      expect(updated.status).toBe('PAID');
    });

    it('từ chối chuyển trạng thái bất hợp lệ: PENDING -> COMPLETED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'PENDING',
        orderItems: [],
      });

      await expect(
        service.updateStatus('ord-1', 'COMPLETED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('khi hủy đơn hàng (CANCELLED): tự động hoàn trả số lượng tồn kho sản phẩm & nguyên liệu', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        orderCode: '#1043',
        status: 'PENDING',
        isInventoryDeducted: true,
        orderItems: [
          { productId: 'prod-1', qty: 2 },
          { productId: 'prod-2', qty: 1 },
        ],
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'CANCELLED',
      });
      // Mock giao dịch trừ nguyên liệu trước đó
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        { ingredientId: 'ing-1', quantity: new Prisma.Decimal(-50) },
      ]);
      prisma.inventoryTransaction.count.mockResolvedValue(0);
      prisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        currentStock: new Prisma.Decimal(100),
      });

      await service.updateStatus('ord-1', 'CANCELLED');

      // Kiểm tra hoàn trả nguyên liệu thô theo BOM thực tế
      expect(prisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-1' },
        data: { currentStock: 150 },
      });
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RESTOCK',
            quantity: 50,
          }),
        }),
      );
    });

    it('khi hủy đơn đã PAID: thu hồi điểm loyalty đã tích', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-paid',
        status: 'PAID',
        userId: 'user-1',
        pointsEarned: 5,
        orderItems: [{ productId: 'prod-1', qty: 1 }],
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-paid',
        status: 'CANCELLED',
      });

      await service.updateStatus('ord-paid', 'CANCELLED');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { decrement: 5 } },
      });
    });
  });

  describe('Task 9: Lịch sử đơn của tôi (findMyOrders)', () => {
    it('trả về danh sách đơn hàng của user tương ứng sắp xếp theo thời gian mới nhất', async () => {
      const mockOrders = [
        { id: 'ord-1', userId: 'user-1', status: 'COMPLETED' },
        { id: 'ord-2', userId: 'user-1', status: 'PAID' },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findMyOrders('user-1');

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual(mockOrders);
    });

    it('ném lỗi BadRequestException nếu không có userId', async () => {
      await expect(service.findMyOrders('')).rejects.toThrow(BadRequestException);
    });
  });
});
