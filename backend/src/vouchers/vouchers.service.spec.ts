import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from './vouchers.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

describe('VouchersService (Quản lý Voucher & Khuyến mãi)', () => {
  let service: VouchersService;
  let prisma: any;

  const mockVoucherPercent = {
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: new Prisma.Decimal(10),
    minOrderAmount: new Prisma.Decimal(40000),
    maxDiscountAmount: new Prisma.Decimal(20000),
    validUntil: new Date(Date.now() + 86400000),
    isActive: true,
  };

  const mockVoucherFixed = {
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
      promotion: {
        findMany: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        delete: jest.fn<any>(),
      },
      order: {
        findFirst: jest.fn<any>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
  });

  describe('1. Danh sách & Chi tiết voucher', () => {
    it('findAll: trả về danh sách voucher', async () => {
      prisma.promotion.findMany.mockResolvedValue([mockVoucherPercent, mockVoucherFixed]);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('WELCOME10');
      expect(result[0].discountValue).toBe(10);
    });

    it('findByCode: trả về chi tiết 1 voucher', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockVoucherPercent);

      const result = await service.findByCode('welcome10');
      expect(result.code).toBe('WELCOME10');
      expect(result.discountType).toBe('PERCENTAGE');
    });

    it('findByCode: ném lỗi NotFoundException khi không tìm thấy', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(service.findByCode('KHONG_TON_TAI')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('2. Tạo voucher mới (create)', () => {
    it('tạo thành công voucher PERCENTAGE hợp lệ', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);
      prisma.promotion.create.mockResolvedValue({
        code: 'SUMMER20',
        discountType: 'PERCENTAGE',
        discountValue: new Prisma.Decimal(20),
        minOrderAmount: new Prisma.Decimal(50000),
        maxDiscountAmount: new Prisma.Decimal(30000),
        validUntil: new Date(),
        isActive: true,
      });

      const res = await service.create({
        code: 'summer20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        minOrderAmount: 50000,
        maxDiscountAmount: 30000,
      });

      expect(res.voucher.code).toBe('SUMMER20');
      expect(prisma.promotion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'SUMMER20',
            discountType: 'PERCENTAGE',
          }),
        }),
      );
    });

    it('ném ConflictException nếu mã voucher đã tồn tại', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockVoucherPercent);

      await expect(
        service.create({
          code: 'WELCOME10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('ném BadRequestException nếu mức giảm % > 100 hoặc <= 0', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          code: 'SUPER150',
          discountType: 'PERCENTAGE',
          discountValue: 150,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Cập nhật voucher (update)', () => {
    it('cập nhật thành công voucher', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockVoucherPercent);
      prisma.promotion.update.mockResolvedValue({
        ...mockVoucherPercent,
        discountValue: new Prisma.Decimal(15),
      });

      const res = await service.update('WELCOME10', { discountValue: 15 });
      expect(res.voucher.discountValue).toBe(15);
    });

    it('ném NotFoundException nếu voucher không tồn tại để sửa', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.update('VOUCHER_LA', { discountValue: 15 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Xóa voucher (delete)', () => {
    it('xóa vĩnh viễn nếu chưa có đơn hàng nào sử dụng', async () => {
      prisma.promotion.findUnique.mockResolvedValue({
        ...mockVoucherPercent,
        _count: { orders: 0 },
      });
      prisma.promotion.delete.mockResolvedValue(mockVoucherPercent);

      const res = await service.delete('WELCOME10');
      expect(res.success).toBe(true);
      expect(prisma.promotion.delete).toHaveBeenCalledWith({
        where: { code: 'WELCOME10' },
      });
    });

    it('tự động chuyển isActive: false để bảo toàn nếu đã có đơn hàng sử dụng', async () => {
      prisma.promotion.findUnique.mockResolvedValue({
        ...mockVoucherPercent,
        _count: { orders: 5 },
      });
      prisma.promotion.update.mockResolvedValue({
        ...mockVoucherPercent,
        isActive: false,
      });

      const res = await service.delete('WELCOME10');
      expect(res.success).toBe(true);
      expect(prisma.promotion.update).toHaveBeenCalledWith({
        where: { code: 'WELCOME10' },
        data: { isActive: false },
      });
    });
  });

  describe('5. Kiểm tra tính hợp lệ voucher (validateVoucher)', () => {
    it('tính đúng số tiền giảm % kèm trần maxDiscountAmount', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockVoucherPercent);
      prisma.order.findFirst.mockResolvedValue(null);

      const res = await service.validateVoucher({
        code: 'WELCOME10',
        subtotal: 100000,
        userId: 'user-new',
      });

      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(10000);
      expect(res.finalTotal).toBe(90000);
    });

    it('ném lỗi khi đơn chưa đạt giá trị tối thiểu', async () => {
      prisma.promotion.findUnique.mockResolvedValue(mockVoucherPercent);

      await expect(
        service.validateVoucher({
          code: 'WELCOME10',
          subtotal: 20000,
        }),
      ).rejects.toThrow('cần tối thiểu');
    });

    it('ném lỗi khi voucher hết hạn', async () => {
      prisma.promotion.findUnique.mockResolvedValue({
        ...mockVoucherPercent,
        validUntil: new Date(Date.now() - 100000),
      });

      await expect(
        service.validateVoucher({
          code: 'WELCOME10',
          subtotal: 50000,
        }),
      ).rejects.toThrow('đã hết hạn');
    });

    it('ném lỗi khi voucher bị tạm khóa (isActive: false)', async () => {
      prisma.promotion.findUnique.mockResolvedValue({
        ...mockVoucherPercent,
        isActive: false,
      });

      await expect(
        service.validateVoucher({
          code: 'WELCOME10',
          subtotal: 50000,
        }),
      ).rejects.toThrow('tạm khóa');
    });
  });
});
