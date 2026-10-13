import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh mã đơn hàng dạng #1042, #1043...
   */
  private async generateOrderCode(): Promise<string> {
    const lastOrder = await this.prisma.order.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderCode: true },
    });

    if (!lastOrder || !lastOrder.orderCode) {
      return '#1042';
    }

    // Tách số từ mã hiện tại (ví dụ: #1042 -> 1042)
    const numericPart = parseInt(lastOrder.orderCode.replace(/\D/g, ''), 10);
    if (isNaN(numericPart)) {
      return '#1042';
    }

    return `#${numericPart + 1}`;
  }

  /**
   * Tính phụ thu theo size đồ uống:
   * Size S: 0đ | Size M: +5.000đ | Size L: +10.000đ
   */
  private getSizeExtraPrice(size: 'S' | 'M' | 'L'): number {
    switch (size) {
      case 'M':
        return 5000;
      case 'L':
        return 10000;
      case 'S':
      default:
        return 0;
    }
  }

  /**
   * Khởi tạo đơn hàng (Task 6 - Sprint 2)
   */
  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    // 1. Thu thập danh sách productId & toppingId cần kiểm tra
    const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const allToppingIds = Array.from(
      new Set(dto.items.flatMap((i) => i.toppingIds || [])),
    );

    // 2. Truy vấn dữ liệu thực tế từ CSDL để chống gian lận giá tiền từ client
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng bán');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let toppingsMap = new Map<string, { id: string; price: Prisma.Decimal }>();
    if (allToppingIds.length > 0) {
      const toppings = await this.prisma.topping.findMany({
        where: {
          id: { in: allToppingIds },
          isAvailable: true,
        },
      });

      if (toppings.length !== allToppingIds.length) {
        throw new NotFoundException('Một hoặc nhiều loại topping không tồn tại hoặc tạm hết hàng');
      }

      toppingsMap = new Map(toppings.map((t) => [t.id, t]));
    }

    // 3. Tính toán chi tiết từng món trong đơn (subtotal)
    let calculatedSubtotal = 0;
    const preparedItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const basePriceNum = Number(product.basePrice);
      const sizeExtra = this.getSizeExtraPrice(item.size);

      // Tính tổng tiền topping của món
      let toppingCostPerUnit = 0;
      const validToppings: { toppingId: string; price: number }[] = [];

      if (item.toppingIds && item.toppingIds.length > 0) {
        for (const tId of item.toppingIds) {
          const t = toppingsMap.get(tId);
          if (t) {
            const tPrice = Number(t.price);
            toppingCostPerUnit += tPrice;
            validToppings.push({ toppingId: t.id, price: tPrice });
          }
        }
      }

      const unitPrice = basePriceNum + sizeExtra + toppingCostPerUnit;
      const lineTotal = unitPrice * item.qty;
      calculatedSubtotal += lineTotal;

      return {
        productId: product.id,
        size: item.size,
        unitPrice,
        qty: item.qty,
        lineTotal,
        toppings: validToppings,
      };
    });

    // 4. Kiểm tra và áp dụng mã khuyến mãi (nếu có)
    let discountAmount = 0;
    let appliedPromotionCode: string | null = null;

    if (dto.promotionCode) {
      const promoCode = dto.promotionCode.trim().toUpperCase();
      const promotion = await this.prisma.promotion.findUnique({
        where: { code: promoCode },
      });

      if (!promotion || !promotion.isActive) {
        throw new BadRequestException(`Mã khuyến mãi "${promoCode}" không hợp lệ hoặc đã hết hạn`);
      }

      if (promotion.validUntil && new Date() > promotion.validUntil) {
        throw new BadRequestException(`Mã khuyến mãi "${promoCode}" đã quá hạn sử dụng`);
      }

      if (promotion.minOrderAmount && calculatedSubtotal < Number(promotion.minOrderAmount)) {
        throw new BadRequestException(
          `Đơn hàng cần tối thiểu ${Number(promotion.minOrderAmount).toLocaleString('vi-VN')}đ để áp dụng mã này`,
        );
      }

      if (promotion.discountType === 'PERCENTAGE') {
        const rawDiscount = (calculatedSubtotal * Number(promotion.discountValue)) / 100;
        const maxDiscount = promotion.maxDiscountAmount ? Number(promotion.maxDiscountAmount) : rawDiscount;
        discountAmount = Math.min(rawDiscount, maxDiscount);
      } else {
        discountAmount = Number(promotion.discountValue);
      }

      // Giảm giá không được vượt quá tổng giá trị đơn
      discountAmount = Math.min(discountAmount, calculatedSubtotal);
      appliedPromotionCode = promotion.code;
    }

    const totalAmount = Math.max(0, calculatedSubtotal - discountAmount);
    // Tích điểm loyalty points: 10.000đ = 1 điểm
    const pointsEarned = Math.floor(totalAmount / 10000);

    // 5. Sinh mã đơn hàng #1042, #1043...
    const orderCode = await this.generateOrderCode();

    // 6. Thực thi Transaction lưu vào CSDL
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderCode,
          userId: dto.userId || null,
          customerName: dto.customerName,
          phone: dto.phone,
          deliveryAddress: dto.deliveryAddress || null,
          notes: dto.notes || null,
          promotionCode: appliedPromotionCode,
          status: 'PENDING',
          subtotal: calculatedSubtotal,
          discountAmount,
          totalAmount,
          pointsEarned,
          orderItems: {
            create: preparedItems.map((item) => ({
              productId: item.productId,
              size: item.size,
              unitPrice: item.unitPrice,
              qty: item.qty,
              lineTotal: item.lineTotal,
              toppings: {
                create: item.toppings.map((t) => ({
                  toppingId: t.toppingId,
                  price: t.price,
                })),
              },
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              product: true,
              toppings: {
                include: {
                  topping: true,
                },
              },
            },
          },
          promotion: true,
        },
      });

      return order;
    });

    return createdOrder;
  }

  /**
   * Lấy danh sách tất cả các đơn hàng
   */
  async findAll(query?: { status?: string; userId?: string; phone?: string }) {
    return this.prisma.order.findMany({
      where: {
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.userId ? { userId: query.userId } : {}),
        ...(query?.phone ? { phone: { contains: query.phone } } : {}),
      },
      include: {
        orderItems: {
          include: {
            product: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
        promotion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tìm đơn hàng theo ID
   */
  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
        promotion: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    return order;
  }

  /**
   * Tìm đơn hàng theo mã đơn (orderCode), ví dụ: "#1042" hoặc "1042"
   */
  async findByOrderCode(code: string) {
    const normalizedCode = code.startsWith('#') ? code : `#${code}`;
    const order = await this.prisma.order.findUnique({
      where: { orderCode: normalizedCode },
      include: {
        orderItems: {
          include: {
            product: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
        promotion: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã "${normalizedCode}"`);
    }

    return order;
  }

  /**
   * Cập nhật trạng thái đơn hàng (PENDING -> PAID -> READY -> COMPLETED / CANCELLED)
   */
  async updateStatus(id: string, status: string) {
    const validStatuses = ['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    const upperStatus = status.toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      throw new BadRequestException(
        `Trạng thái "${status}" không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}`,
      );
    }

    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: upperStatus },
      include: {
        orderItems: {
          include: {
            product: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
        promotion: true,
      },
    });
  }
}
