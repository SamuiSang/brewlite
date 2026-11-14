import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
} from './dto/voucher.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách tất cả voucher kèm bộ lọc trạng thái và tìm kiếm
   */
  async findAll(params?: { isActive?: boolean; search?: string }) {
    const where: Prisma.PromotionWhereInput = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      where.code = { contains: params.search.trim().toUpperCase() };
    }

    const vouchers = await this.prisma.promotion.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return vouchers.map((v) => ({
      code: v.code,
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      minOrderAmount: v.minOrderAmount ? Number(v.minOrderAmount) : null,
      maxDiscountAmount: v.maxDiscountAmount ? Number(v.maxDiscountAmount) : null,
      validUntil: v.validUntil,
      isActive: v.isActive,
    }));
  }

  /**
   * Lấy chi tiết 1 voucher theo code
   */
  async findByCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const voucher = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy mã voucher "${normalizedCode}"`);
    }

    return {
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      minOrderAmount: voucher.minOrderAmount ? Number(voucher.minOrderAmount) : null,
      maxDiscountAmount: voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null,
      validUntil: voucher.validUntil,
      isActive: voucher.isActive,
    };
  }

  /**
   * Tạo voucher mới
   */
  async create(dto: CreateVoucherDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // 1. Kiểm tra mã đã tồn tại chưa
    const existing = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new ConflictException(`Mã voucher "${normalizedCode}" đã tồn tại trong hệ thống.`);
    }

    // 2. Validate phần trăm nếu discountType là PERCENTAGE
    if (dto.discountType === 'PERCENTAGE' && (dto.discountValue <= 0 || dto.discountValue > 100)) {
      throw new BadRequestException('Mức giảm giá theo phần trăm phải nằm trong khoảng từ 1% đến 100%');
    }

    const created = await this.prisma.promotion.create({
      data: {
        code: normalizedCode,
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        minOrderAmount: dto.minOrderAmount !== undefined ? new Prisma.Decimal(dto.minOrderAmount) : null,
        maxDiscountAmount: dto.maxDiscountAmount !== undefined ? new Prisma.Decimal(dto.maxDiscountAmount) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      message: `Tạo mã voucher "${created.code}" thành công`,
      voucher: {
        code: created.code,
        discountType: created.discountType,
        discountValue: Number(created.discountValue),
        minOrderAmount: created.minOrderAmount ? Number(created.minOrderAmount) : null,
        maxDiscountAmount: created.maxDiscountAmount ? Number(created.maxDiscountAmount) : null,
        validUntil: created.validUntil,
        isActive: created.isActive,
      },
    };
  }

  /**
   * Cập nhật thông tin voucher
   */
  async update(code: string, dto: UpdateVoucherDto) {
    const normalizedCode = code.trim().toUpperCase();
    const existing = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy mã voucher "${normalizedCode}" để cập nhật`);
    }

    const discountType = dto.discountType || existing.discountType;
    const discountValue = dto.discountValue !== undefined ? dto.discountValue : Number(existing.discountValue);

    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      throw new BadRequestException('Mức giảm giá theo phần trăm phải nằm trong khoảng từ 1% đến 100%');
    }

    const data: Prisma.PromotionUpdateInput = {};
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = new Prisma.Decimal(dto.discountValue);
    if (dto.minOrderAmount !== undefined) data.minOrderAmount = new Prisma.Decimal(dto.minOrderAmount);
    if (dto.maxDiscountAmount !== undefined) data.maxDiscountAmount = new Prisma.Decimal(dto.maxDiscountAmount);
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.promotion.update({
      where: { code: normalizedCode },
      data,
    });

    return {
      message: `Cập nhật mã voucher "${normalizedCode}" thành công`,
      voucher: {
        code: updated.code,
        discountType: updated.discountType,
        discountValue: Number(updated.discountValue),
        minOrderAmount: updated.minOrderAmount ? Number(updated.minOrderAmount) : null,
        maxDiscountAmount: updated.maxDiscountAmount ? Number(updated.maxDiscountAmount) : null,
        validUntil: updated.validUntil,
        isActive: updated.isActive,
      },
    };
  }

  /**
   * Xóa voucher (hoặc vô hiệu hóa an toàn nếu đã có đơn hàng sử dụng)
   */
  async delete(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const existing = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy mã voucher "${normalizedCode}"`);
    }

    // Nếu đã có đơn hàng sử dụng mã này thì không xóa vật lý mà chuyển sang isActive = false để bảo toàn toàn vẹn dữ liệu
    if (existing._count.orders > 0) {
      await this.prisma.promotion.update({
        where: { code: normalizedCode },
        data: { isActive: false },
      });
      return {
        success: true,
        message: `Mã voucher "${normalizedCode}" đã có ${existing._count.orders} đơn hàng sử dụng. Hệ thống đã tự động chuyển sang trạng thái Vô hiệu hóa (isActive: false) để bảo toàn lịch sử đơn hàng.`,
      };
    }

    await this.prisma.promotion.delete({
      where: { code: normalizedCode },
    });

    return {
      success: true,
      message: `Đã xóa vĩnh viễn mã voucher "${normalizedCode}" thành công.`,
    };
  }

  /**
   * Kiểm tra voucher (Validate Voucher logic)
   */
  async validateVoucher(dto: ValidateVoucherDto) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const voucher = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (!voucher) {
      throw new BadRequestException(`Mã khuyến mãi "${normalizedCode}" không hợp lệ hoặc không tồn tại`);
    }

    if (!voucher.isActive) {
      throw new BadRequestException(`Mã khuyến mãi "${voucher.code}" hiện đang bị tạm khóa / không hoạt động`);
    }

    if (voucher.validUntil && new Date() > voucher.validUntil) {
      throw new BadRequestException(`Mã khuyến mãi "${voucher.code}" đã hết hạn sử dụng`);
    }

    const minOrder = voucher.minOrderAmount ? Number(voucher.minOrderAmount) : 0;
    if (dto.subtotal < minOrder) {
      throw new BadRequestException(
        `Đơn hàng cần tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để áp dụng mã "${voucher.code}" (hiện tại: ${dto.subtotal.toLocaleString('vi-VN')}đ)`,
      );
    }

    // Kiểm tra mã đơn đầu WELCOME10
    if (normalizedCode === 'WELCOME10') {
      if (!dto.userId) {
        throw new BadRequestException('Mã WELCOME10 chỉ áp dụng cho khách hàng đã đăng nhập tài khoản');
      }
      const existingPaidOrder = await this.prisma.order.findFirst({
        where: {
          userId: dto.userId,
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
        },
      });
      if (existingPaidOrder) {
        throw new BadRequestException('Mã WELCOME10 chỉ áp dụng cho đơn hàng đầu tiên của tài khoản');
      }
    }

    // Tính toán số tiền giảm giá
    let discountAmount = 0;
    const value = Number(voucher.discountValue);
    if (voucher.discountType === 'PERCENTAGE') {
      const rawDiscount = (dto.subtotal * value) / 100;
      const maxDiscount = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : Infinity;
      discountAmount = Math.min(rawDiscount, maxDiscount);
    } else {
      discountAmount = value;
    }

    discountAmount = Math.min(discountAmount, dto.subtotal);
    const finalTotal = Math.max(0, dto.subtotal - discountAmount);

    return {
      valid: true,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: value,
      discountAmount,
      minOrderAmount: minOrder,
      maxDiscountAmount: voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null,
      finalTotal,
      message: `Áp dụng mã "${voucher.code}" thành công, bạn được giảm ${discountAmount.toLocaleString('vi-VN')}đ`,
    };
  }
}
