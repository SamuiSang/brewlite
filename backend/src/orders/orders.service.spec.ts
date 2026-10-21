import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

describe('OrdersService (Task 10 - Optimistic Lock, Voucher, Loyalty, State Machine)', () => {
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
    validUntil: new Date(Date.now() + 86400000), // ngày mai
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
      // Đảm bảo prisma.product.updateMany được gọi với điều kiện version và stock
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'prod-1',
          version: 1, // OCC version check
          stock: { gte: 2 },
        },
        data: {
          stock: { decrement: 2 },
          version: { increment: 1 }, // OCC version increment
        },
      });
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('khi số lượng đặt vượt quá số lượng tồn kho: ném lỗi BadRequestException', async () => {
      // Mock tồn kho chỉ còn 1
      prisma.product.findMany.mockResolvedValue([{ ...mockProductA, stock: 1 }]);

      const dto = {
        customerName: 'Nguyễn Văn Quang',
        phone: '0901234567',
        items: [
          {
            productId: 'prod-1',
            size: 'S' as const,
            qty: 3,
          },
        ],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        /không đủ số lượng tồn kho/,
      );
    });

    it('khi xảy ra xung đột Optimistic Lock (version bị thay đổi bởi transaction khác): ném ConflictException sau khi thử lại', async () => {
      prisma.product.findMany.mockResolvedValue([mockProductA]);
      prisma.order.findFirst.mockResolvedValue({ orderCode: '#1042' });

      // updateMany trả về count: 0 (version không khớp)
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

  describe('2. Voucher / Promotion Calculation', () => {
    it('tính giảm giá theo % kèm trần maxDiscountAmount chính xác', () => {
      // Đơn 300.000đ, giảm 10% = 30.000đ, nhưng maxDiscount là 20.000đ -> giảm 20.000đ
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
        validUntil: new Date(Date.now() - 86400000), // hôm qua
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
      expect(result.discountAmount).toBe(10000); // 10% của 100.000đ
      expect(result.finalAmount).toBe(90000);
    });
  });

  describe('3. Loyalty Points (Tích điểm & Tiêu điểm)', () => {
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
        useLoyaltyPoints: 10, // 10 điểm = 10.000đ
        items: [{ productId: 'prod-1', size: 'S' as const, qty: 1 }], // 35.000đ
      };

      await service.createOrder(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { decrement: 10 } },
      });
      // 35.000đ - 10.000đ = 25.000đ
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
        useLoyaltyPoints: 20, // cần 20 nhưng chỉ có 5
        items: [{ productId: 'prod-1', size: 'S' as const, qty: 1 }],
      };

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('4. Máy trạng thái đơn hàng (Order State Machine) & Hoàn tồn kho trong updateStatus', () => {
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

    it('khi hủy đơn hàng (CANCELLED): tự động hoàn trả số lượng tồn kho sản phẩm', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'PENDING',
        orderItems: [
          { productId: 'prod-1', qty: 2 },
          { productId: 'prod-2', qty: 1 },
        ],
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'CANCELLED',
      });

      await service.updateStatus('ord-1', 'CANCELLED');

      // Phải hoàn trả kho cho cả 2 sản phẩm
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          stock: { increment: 2 },
          version: { increment: 1 },
        },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-2' },
        data: {
          stock: { increment: 1 },
          version: { increment: 1 },
        },
      });
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
});
