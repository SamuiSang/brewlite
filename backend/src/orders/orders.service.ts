import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, ValidateVoucherDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';
import { OrderStateMachine, OrderStatus } from './order-state-machine';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh mã đơn hàng dạng #1042, #1043...
   */
  private async generateOrderCode(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const lastOrder = await client.order.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderCode: true },
    });

    if (!lastOrder || !lastOrder.orderCode) {
      return '#1042';
    }

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
   * Tính toán mức giảm giá từ Voucher / Promotion
   */
  calculatePromotionDiscount(
    promotion: {
      code: string;
      discountType: string;
      discountValue: Prisma.Decimal | number;
      minOrderAmount?: Prisma.Decimal | number | null;
      maxDiscountAmount?: Prisma.Decimal | number | null;
      validUntil?: Date | null;
      isActive: boolean;
    },
    subtotal: number,
  ): number {
    if (!promotion.isActive) {
      throw new BadRequestException(
        `Mã khuyến mãi "${promotion.code}" hiện không hoạt động`,
      );
    }

    if (promotion.validUntil && new Date() > promotion.validUntil) {
      throw new BadRequestException(
        `Mã khuyến mãi "${promotion.code}" đã quá hạn sử dụng`,
      );
    }

    if (
      promotion.minOrderAmount &&
      subtotal < Number(promotion.minOrderAmount)
    ) {
      throw new BadRequestException(
        `Đơn hàng cần tối thiểu ${Number(promotion.minOrderAmount).toLocaleString('vi-VN')}đ để áp dụng mã "${promotion.code}"`,
      );
    }

    let discountAmount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      const rawDiscount = (subtotal * Number(promotion.discountValue)) / 100;
      const maxDiscount = promotion.maxDiscountAmount
        ? Number(promotion.maxDiscountAmount)
        : rawDiscount;
      discountAmount = Math.min(rawDiscount, maxDiscount);
    } else {
      discountAmount = Number(promotion.discountValue);
    }

    return Math.min(discountAmount, subtotal);
  }

  /**
   * API Kiểm tra & tính thử giá trị giảm giá của Voucher (dành cho frontend)
   */
  async validateVoucher(dto: ValidateVoucherDto) {
    const promoCode = dto.code.trim().toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: promoCode },
    });

    if (!promotion) {
      throw new NotFoundException(`Mã khuyến mãi "${promoCode}" không tồn tại`);
    }

    const discountAmount = this.calculatePromotionDiscount(
      promotion,
      dto.subtotal,
    );

    return {
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue),
      minOrderAmount: promotion.minOrderAmount
        ? Number(promotion.minOrderAmount)
        : null,
      maxDiscountAmount: promotion.maxDiscountAmount
        ? Number(promotion.maxDiscountAmount)
        : null,
      validUntil: promotion.validUntil,
      subtotal: dto.subtotal,
      discountAmount,
      finalAmount: Math.max(0, dto.subtotal - discountAmount),
    };
  }

  /**
   * Khởi tạo đơn hàng với Khóa tồn kho đồng thời (Optimistic Lock version),
   * Voucher & Loyalty points (Task 10 - Quang)
   */
  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    // 1. Gom số lượng yêu cầu theo từng productId để kiểm tra tổng tồn kho
    const requiredProductQtyMap = new Map<string, number>();
    for (const item of dto.items) {
      const current = requiredProductQtyMap.get(item.productId) || 0;
      requiredProductQtyMap.set(item.productId, current + item.qty);
    }

    const productIds = Array.from(requiredProductQtyMap.keys());
    const allToppingIds = Array.from(
      new Set(dto.items.flatMap((i) => i.toppingIds || [])),
    );

    // 2. Tải toppings hợp lệ (nếu có)
    let toppingsMap = new Map<string, { id: string; price: Prisma.Decimal }>();
    if (allToppingIds.length > 0) {
      const toppings = await this.prisma.topping.findMany({
        where: {
          id: { in: allToppingIds },
          isAvailable: true,
        },
      });

      if (toppings.length !== allToppingIds.length) {
        throw new NotFoundException(
          'Một hoặc nhiều loại topping không tồn tại hoặc tạm hết hàng',
        );
      }

      toppingsMap = new Map(toppings.map((t) => [t.id, t]));
    }

    // 3. Cơ chế Retry khi gặp Optimistic Concurrency Conflict
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        return await this.executeCreateOrderTransaction(
          dto,
          requiredProductQtyMap,
          productIds,
          toppingsMap,
        );
      } catch (error) {
        // Nếu là lỗi xung đột Optimistic Lock và còn lượt retry -> thử lại
        if (error instanceof ConflictException && attempt < MAX_RETRIES) {
          // Chờ ngẫu nhiên một khoảng ngắn (backoff jitter)
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * attempt + Math.floor(Math.random() * 50)),
          );
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Hệ thống đang quá tải giao dịch cho sản phẩm này. Vui lòng thử lại sau giây lát!',
    );
  }

  /**
   * Thực thi Transaction tạo đơn hàng kèm Optimistic Locking
   */
  private async executeCreateOrderTransaction(
    dto: CreateOrderDto,
    requiredProductQtyMap: Map<string, number>,
    productIds: string[],
    toppingsMap: Map<string, { id: string; price: Prisma.Decimal }>,
  ) {
    // Truy vấn dữ liệu sản phẩm mới nhất kèm version
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException(
        'Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng bán',
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Kiểm tra số lượng tồn kho trước khi vào transaction
    for (const [pId, reqQty] of requiredProductQtyMap.entries()) {
      const product = productMap.get(pId)!;
      if (product.stock < reqQty) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" không đủ số lượng tồn kho (chỉ còn ${product.stock}, yêu cầu ${reqQty})`,
        );
      }
    }

    // Tính toán chi tiết từng món trong đơn
    let calculatedSubtotal = 0;
    const preparedItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const basePriceNum = Number(product.basePrice);
      const sizeExtra = this.getSizeExtraPrice(item.size);

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

    // 4. Áp dụng Voucher / Khuyến mãi (nếu có)
    let voucherDiscount = 0;
    let appliedPromotionCode: string | null = null;

    if (dto.promotionCode) {
      const promoCode = dto.promotionCode.trim().toUpperCase();
      const promotion = await this.prisma.promotion.findUnique({
        where: { code: promoCode },
      });

      if (!promotion) {
        throw new BadRequestException(
          `Mã khuyến mãi "${promoCode}" không hợp lệ hoặc không tồn tại`,
        );
      }

      voucherDiscount = this.calculatePromotionDiscount(
        promotion,
        calculatedSubtotal,
      );
      appliedPromotionCode = promotion.code;
    }

    // 5. Xử lý Điểm tích lũy thành viên (Loyalty Points)
    // Quy ước: 1 điểm = 1.000đ giảm giá
    const POINT_TO_VND_RATE = 1000;
    let loyaltyDiscount = 0;
    let pointsToDeduct = 0;

    if (dto.useLoyaltyPoints && dto.useLoyaltyPoints > 0) {
      if (!dto.userId) {
        throw new BadRequestException(
          'Vui lòng đăng nhập để sử dụng điểm thưởng tích lũy',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy tài khoản người dùng');
      }

      if (user.loyaltyPoints < dto.useLoyaltyPoints) {
        throw new BadRequestException(
          `Tài khoản chỉ có ${user.loyaltyPoints} điểm, không đủ ${dto.useLoyaltyPoints} điểm để sử dụng`,
        );
      }

      const maxAllowedDiscount = Math.max(0, calculatedSubtotal - voucherDiscount);
      const requestedDiscount = dto.useLoyaltyPoints * POINT_TO_VND_RATE;

      loyaltyDiscount = Math.min(requestedDiscount, maxAllowedDiscount);
      pointsToDeduct = Math.ceil(loyaltyDiscount / POINT_TO_VND_RATE);
    }

    const totalDiscount = voucherDiscount + loyaltyDiscount;
    const totalAmount = Math.max(0, calculatedSubtotal - totalDiscount);

    // Tích điểm mới: Mỗi 10.000đ = 1 điểm tích lũy
    const pointsEarned = Math.floor(totalAmount / 10000);

    // 6. Thực thi Transaction nguyên tử (Atomic Database Transaction)
    return await this.prisma.$transaction(async (tx) => {
      // 6.1. OPTIMISTIC LOCKING: Khóa tồn kho đồng thời với version check
      for (const [pId, reqQty] of requiredProductQtyMap.entries()) {
        const currentProd = productMap.get(pId)!;

        // Chỉ update thành công khi version khớp VÀ stock >= reqQty
        const updateResult = await tx.product.updateMany({
          where: {
            id: pId,
            version: currentProd.version,
            stock: { gte: reqQty },
          },
          data: {
            stock: { decrement: reqQty },
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          // Xung đột phiên bản do có giao dịch đồng thời vừa sửa bản ghi này
          throw new ConflictException(
            `Xung đột dữ liệu khi khóa tồn kho cho món "${currentProd.name}". Phiên bản đã thay đổi.`,
          );
        }
      }

      // 6.2. Trừ điểm Loyalty đã dùng (nếu có)
      if (pointsToDeduct > 0 && dto.userId) {
        await tx.user.update({
          where: { id: dto.userId },
          data: {
            loyaltyPoints: { decrement: pointsToDeduct },
          },
        });
      }

      // 6.3. Sinh mã đơn hàng
      const orderCode = await this.generateOrderCode(tx);

      // 6.4. Lưu đơn hàng
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
          discountAmount: totalDiscount,
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
        payments: true,
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
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng với mã "${normalizedCode}"`,
      );
    }

    return order;
  }

  /**
   * Lấy các trạng thái kế tiếp hợp lệ theo Order State Machine
   */
  async getAllowedNextStatuses(id: string) {
    const order = await this.findOne(id);
    const currentStatus = order.status as OrderStatus;
    return {
      orderId: order.id,
      orderCode: order.orderCode,
      currentStatus,
      allowedNextStatuses:
        OrderStateMachine.getNextAllowedStatuses(currentStatus),
      isTerminal: OrderStateMachine.isTerminalStatus(currentStatus),
    };
  }

  /**
   * Cập nhật trạng thái đơn hàng tuân thủ Máy trạng thái đơn hàng (Order State Machine)
   * Kèm Hoàn trả tồn kho và Khôi phục điểm thưởng khi đơn bị CANCELLED
   */
  async updateStatus(id: string, status: string) {
    const upperStatus = status.toUpperCase();

    if (!OrderStateMachine.isValidStatus(upperStatus)) {
      throw new BadRequestException(
        `Trạng thái "${status}" không hợp lệ. Phải là một trong: ${OrderStateMachine.getNextAllowedStatuses(
          'PENDING',
        ).concat(['PENDING', 'COMPLETED', 'CANCELLED']).join(', ')}`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    const currentStatus = order.status as OrderStatus;
    const targetStatus = upperStatus as OrderStatus;

    // Xác thực chuyển đổi trạng thái bằng Order State Machine
    OrderStateMachine.validateTransition(currentStatus, targetStatus);

    if (currentStatus === targetStatus) {
      return this.findOne(id);
    }

    // Thực hiện chuyển đổi trạng thái kèm Side-effects trong Transaction
    return await this.prisma.$transaction(async (tx) => {
      // Khi hủy đơn hàng (CANCELLED): Hoàn trả tồn kho cho tất cả các món trong đơn
      if (targetStatus === 'CANCELLED') {
        // 1. Hoàn trả tồn kho (Restock / Replenishment)
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.qty },
              version: { increment: 1 },
            },
          });
        }

        // 2. Nếu đơn trước đó đã PAID và có tích điểm cho User -> Thu hồi điểm thưởng đã tích
        if (
          currentStatus === 'PAID' &&
          order.userId &&
          order.pointsEarned &&
          order.pointsEarned > 0
        ) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { decrement: order.pointsEarned },
            },
          });
        }
      }

      // Cập nhật trạng thái đơn
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: targetStatus },
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
          payments: true,
        },
      });

      return updatedOrder;
    });
  }
}
