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
import { requiredIngredients } from '../products/recipe';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh mã đơn hàng dạng #1042, #1043...
   */
  private async generateOrderCode(
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
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

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
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
    productIds: string[],
    toppingsMap: Map<string, { id: string; price: Prisma.Decimal }>,
  ) {
    // Read recipes and ingredient balances for this attempt.
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: { recipeIngredients: { include: { ingredient: true } } },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException(
        'Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng bán',
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const consumption = requiredIngredients(dto.items, productMap);

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
    // Quy ước: 1 điểm = 500đ giảm giá
    const POINT_TO_VND_RATE = 500;
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

      const maxAllowedDiscount = Math.max(
        0,
        calculatedSubtotal - voucherDiscount,
      );
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
      // Stable lock order avoids deadlocks when products share ingredients.
      for (const [ingredientId, { ingredient, quantity }] of [
        ...consumption,
      ].sort(([a], [b]) => a.localeCompare(b))) {
        const result = await tx.ingredient.updateMany({
          where: {
            id: ingredientId,
            version: ingredient.version,
            stock: { gte: quantity },
          },
          data: { stock: { decrement: quantity }, version: { increment: 1 } },
        });
        if (result.count !== 1) {
          throw new ConflictException(
            `Tồn kho nguyên liệu "${ingredient.name}" vừa thay đổi. Vui lòng thử lại.`,
          );
        }
      }

      // 6.2. Trừ điểm Loyalty đã dùng (nếu có)
      if (pointsToDeduct > 0 && dto.userId) {
        const redeemed = await tx.user.updateMany({
          where: { id: dto.userId, loyaltyPoints: { gte: pointsToDeduct } },
          data: { loyaltyPoints: { decrement: pointsToDeduct } },
        });
        if (redeemed.count !== 1)
          throw new BadRequestException('Điểm thưởng không còn đủ để sử dụng');
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
          ingredients: {
            create: [...consumption].map(([ingredientId, { quantity }]) => ({
              ingredientId,
              quantity,
            })),
          },
          subtotal: calculatedSubtotal,
          discountAmount: totalDiscount,
          totalAmount,
          pointsEarned,
          pointsRedeemed: pointsToDeduct,
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
  /**
   * Lấy danh sách lịch sử đơn hàng của người dùng đang đăng nhập (Task 9 - Sprint 3)
   * GET /orders/me
   */
  async findMyOrders(userId: string) {
    if (!userId) {
      throw new BadRequestException(
        'Không tìm thấy thông tin tài khoản người dùng',
      );
    }
    return this.prisma.order.findMany({
      where: { userId },
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
      orderBy: { createdAt: 'desc' },
    });
  }

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
   * Task 10.1 (Chiến): Cập nhật trạng thái đơn hàng tuân thủ Máy trạng thái đơn hàng (Order State Machine)
   * Bổ sung logic: nếu trạng thái đơn chuyển sang 'CANCELLED' -> tự động cộng hoàn lại
   * số lượng tồn kho stock và tăng version của sản phẩm trong CSDL.
   * Đồng thời thu hồi điểm thưởng loyalty nếu đơn đã thanh toán trước đó.
   */
  async updateStatus(id: string, status: string) {
    const upperStatus = status.toUpperCase();

    if (!OrderStateMachine.isValidStatus(upperStatus)) {
      throw new BadRequestException(
        `Trạng thái "${status}" không hợp lệ. Phải là một trong: ${OrderStateMachine.getNextAllowedStatuses(
          'PENDING',
        )
          .concat(['PENDING', 'COMPLETED', 'CANCELLED'])
          .join(', ')}`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: true,
        ingredients: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    const currentStatus = order.status as OrderStatus;
    const targetStatus = upperStatus as OrderStatus;

    // Xác thực chuyển đổi trạng thái bằng Order State Machine (Task 10.1)
    OrderStateMachine.validateTransition(currentStatus, targetStatus);

    if (currentStatus === targetStatus) {
      return this.findOne(id);
    }

    // Thực hiện chuyển đổi trạng thái kèm Side-effects trong Transaction (Task 10.1)
    return await this.prisma.$transaction(async (tx) => {
      // Claim transition before side effects: concurrent cancellations restore once.
      const claimed = await tx.order.updateMany({
        where: { id, status: currentStatus },
        data: { status: targetStatus },
      });
      if (claimed.count !== 1)
        throw new ConflictException(
          'Trạng thái đơn vừa thay đổi. Vui lòng tải lại.',
        );

      // Restore the recorded quantities, not the current recipe.
      if (targetStatus === 'CANCELLED') {
        for (const item of [...order.ingredients].sort((a, b) =>
          a.ingredientId.localeCompare(b.ingredientId),
        )) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: {
              stock: { increment: item.quantity },
              version: { increment: 1 },
            },
          });
        }

        if (order.userId && order.pointsRedeemed > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: order.pointsRedeemed } },
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
