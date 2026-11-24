import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, ValidateVoucherDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';
import { OrderStateMachine, OrderStatus } from './order-state-machine';

@Injectable()
export class OrdersService {
  // Idempotency cache: lưu kết quả đơn hàng theo idempotencyKey trong 10 phút
  private readonly idempotencyCache = new Map<
    string,
    { order: any; timestamp: number }
  >();

  // Map theo dõi các request đang xử lý (In-flight requests) để chống race condition
  private readonly inFlightRequests = new Map<string, Promise<any>>();

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
  getSizeExtraPrice(size: 'S' | 'M' | 'L'): number {
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

  private async checkFirstOrderVoucher(code: string, userId?: string, client: Prisma.TransactionClient = this.prisma) {
    if (!code) return;

    if (code === 'WELCOME10') {
      if (!userId) throw new BadRequestException('Vui lòng đăng nhập để sử dụng mã WELCOME10');
      if (await client.order.count({ where: { userId } })) {
        throw new BadRequestException('Mã WELCOME10 chỉ áp dụng cho đơn hàng đầu tiên');
      }
      return;
    }

    // Mỗi khuyến mãi chỉ được dùng 1 lần cho 1 tài khoản
    if (userId) {
      const usedCount = await client.order.count({
        where: {
          userId,
          promotionCode: code,
          status: { not: 'CANCELLED' },
        },
      });
      if (usedCount > 0) {
        throw new BadRequestException(`Bạn đã sử dụng mã khuyến mãi "${code}" rồi`);
      }
    }
  }

  /**
   * API Kiểm tra & tính thử giá trị giảm giá của Voucher (dành cho frontend)
   */
  async validateVoucher(dto: ValidateVoucherDto, userId?: string) {
    const promoCode = dto.code.trim().toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: promoCode },
    });

    if (!promotion) {
      throw new NotFoundException(`Mã khuyến mãi "${promoCode}" không tồn tại`);
    }

    await this.checkFirstOrderVoucher(promoCode, userId);
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
   * Khởi tạo đơn hàng với:
   * 1. Kiểm tra định mức nguyên liệu công thức món (BOM - Bill of Materials).
   * 2. Khóa tồn kho đồng thời (Optimistic Locking).
   * 3. Trừ kho nguyên liệu và lưu nhật ký giao dịch kho (Inventory Transactions).
   * 4. Voucher & Loyalty points.
   * 5. Chống tạo đơn trùng lặp (Idempotency Key & Concurrent Request Deduplication).
   */
  async createOrder(dto: CreateOrderDto, idempotencyKey?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    // 1. Kiểm tra Idempotency Cache: Nếu cùng key đã xử lý thành công, trả về kết quả cũ
    const trimmedKey = idempotencyKey?.trim();
    if (trimmedKey) {
      const cached = this.idempotencyCache.get(trimmedKey);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return cached.order;
      }

      // Nếu có request trùng key đang trong quá trình thực thi, chờ promise đó hoàn thành
      const inFlight = this.inFlightRequests.get(trimmedKey);
      if (inFlight) {
        return await inFlight;
      }
    }

    // Key chống trùng lặp theo user trong 2.5 giây khi client gửi request trùng
    const userDedupKey = dto.userId
      ? `user-dedup:${dto.userId}:${dto.items
          .map(
            (i) =>
              `${i.productId}:${i.size}:${i.qty}:${(i.toppingIds || []).slice().sort().join(',')}`,
          )
          .join('|')}`
      : undefined;

    if (userDedupKey) {
      const cached = this.idempotencyCache.get(userDedupKey);
      if (cached && Date.now() - cached.timestamp < 2500) {
        return cached.order;
      }
      const inFlight = this.inFlightRequests.get(userDedupKey);
      if (inFlight) {
        return await inFlight;
      }
    }

    const processOrder = async () => {
      // 1. Gom số lượng yêu cầu theo từng productId để kiểm tra tổng tồn kho sản phẩm
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
          if (error instanceof ConflictException && attempt < MAX_RETRIES) {
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
    };

    const inFlightPromise = processOrder();

    if (trimmedKey) {
      this.inFlightRequests.set(trimmedKey, inFlightPromise);
    }
    if (userDedupKey) {
      this.inFlightRequests.set(userDedupKey, inFlightPromise);
    }

    try {
      const order = await inFlightPromise;
      if (trimmedKey) {
        this.idempotencyCache.set(trimmedKey, {
          order,
          timestamp: Date.now(),
        });
      }
      if (userDedupKey) {
        this.idempotencyCache.set(userDedupKey, {
          order,
          timestamp: Date.now(),
        });
      }
      return order;
    } finally {
      if (trimmedKey) {
        this.inFlightRequests.delete(trimmedKey);
      }
      if (userDedupKey) {
        this.inFlightRequests.delete(userDedupKey);
      }
    }
  }

  /**
   * Thực thi Transaction tạo đơn hàng kèm kiểm tra nguyên liệu & Optimistic Locking
   */
  private async executeCreateOrderTransaction(
    dto: CreateOrderDto,
    requiredProductQtyMap: Map<string, number>,
    productIds: string[],
    toppingsMap: Map<string, { id: string; price: Prisma.Decimal }>,
  ) {
    // 1. Truy vấn sản phẩm
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

    // 2. TÍNH TOÁN NGUYÊN LIỆU THEO CÔNG THỨC (BOM - Bill of Materials)
    // Nghiệp vụ chuẩn: Không lưu tồn kho theo ly cà phê thành phẩm pha sẵn.
    // Tồn kho được quản lý theo Nguyên liệu thô (Raw Ingredients): Cà phê (g), Sữa (ml), Ly/Nắp (cái).
    // Hệ thống đối soát công thức (Recipe) và tổng nguyên liệu thực tế trước khi nhận đơn.
    const requiredIngredientsMap = new Map<
      string,
      { id: string; name: string; unit: string; requiredAmount: number }
    >();

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      const prodName = product?.name || item.productId;

      // 1. Chuẩn hóa kích thước ly (size)
      let normalizedSize = item.size?.toUpperCase()?.trim();
      if (normalizedSize === 'REGULAR' || normalizedSize === 'SMALL') normalizedSize = 'S';
      else if (normalizedSize === 'MEDIUM') normalizedSize = 'M';
      else if (normalizedSize === 'LARGE') normalizedSize = 'L';
      else if (!normalizedSize) normalizedSize = 'M';

      // 2. Tìm công thức theo size chuẩn hóa
      let recipes = await this.prisma.productRecipe.findMany({
        where: { productId: item.productId, size: normalizedSize },
        include: { ingredient: true },
      });

      // 3. Nếu không tìm thấy, thử tìm theo size nguyên bản gửi lên
      if (recipes.length === 0 && item.size) {
        recipes = await this.prisma.productRecipe.findMany({
          where: { productId: item.productId, size: item.size },
          include: { ingredient: true },
        });
      }

      // 4. Nếu không tìm thấy, thử tìm công thức chung (size = null)
      if (recipes.length === 0) {
        recipes = await this.prisma.productRecipe.findMany({
          where: { productId: item.productId, size: null },
          include: { ingredient: true },
        });
      }

      // 5. Nếu size hiện tại chưa cấu hình nhưng sản phẩm có công thức ở size khác, fallback sang size có sẵn
      if (recipes.length === 0) {
        const anyRecipes = await this.prisma.productRecipe.findMany({
          where: { productId: item.productId },
          include: { ingredient: true },
        });
        if (anyRecipes.length > 0) {
          const fallbackSize = anyRecipes[0].size;
          recipes = anyRecipes.filter((r) => r.size === fallbackSize);
        }
      }

      // 6. Kiểm tra chốt chặn: Nếu sản phẩm hoàn toàn chưa cấu hình công thức -> Chặn bán
      if (recipes.length === 0) {
        throw new BadRequestException(
          `Sản phẩm "${prodName}" chưa được cấu hình công thức định lượng nguyên liệu (Recipe). Vui lòng cấu hình định lượng kho trước khi bán!`,
        );
      }

      for (const r of recipes) {
        const amount = Number(r.amount);
        const wasteRate = Number((r as any).wasteRate || 0);
        const effectivePerUnit = amount * (1 + wasteRate / 100);
        const amountNeeded = Math.round(effectivePerUnit * item.qty * 100) / 100;

        const existing = requiredIngredientsMap.get(r.ingredientId);
        if (existing) {
          existing.requiredAmount = Math.round((existing.requiredAmount + amountNeeded) * 100) / 100;
        } else {
          requiredIngredientsMap.set(r.ingredientId, {
            id: r.ingredientId,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            requiredAmount: amountNeeded,
          });
        }
      }
    }

    // Kiểm tra định mức nguyên liệu trước khi tiến hành tính tiền và mở transaction
    for (const [ingId, req] of requiredIngredientsMap.entries()) {
      const ing = await this.prisma.ingredient.findUnique({ where: { id: ingId } });
      if (!ing) {
        throw new BadRequestException(`Không tìm thấy nguyên liệu: ${req.name}`);
      }

      const currentStock = Number(ing.currentStock);
      if (currentStock < req.requiredAmount) {
        const missing = Math.round((req.requiredAmount - currentStock) * 100) / 100;
        throw new BadRequestException(
          `Không đủ nguyên liệu để pha chế: ${req.name} (cần ${req.requiredAmount} ${req.unit}, hiện chỉ còn ${currentStock} ${req.unit}, thiếu ${missing} ${req.unit})`,
        );
      }
    }

    // 3. Tính toán chi tiết các món trong đơn
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

    // 4. Áp dụng Voucher
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

      await this.checkFirstOrderVoucher(promoCode, dto.userId);
      voucherDiscount = this.calculatePromotionDiscount(
        promotion,
        calculatedSubtotal,
      );
      appliedPromotionCode = promotion.code;
    }

    // 5. Xử lý Điểm Loyalty
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
    const pointsEarned = Math.floor(totalAmount / 10000);

    // 6. Thực thi Transaction nguyên tử
    return await this.prisma.$transaction(async (tx) => {
      if (dto.userId) {
        // Khóa cùng tài khoản để hai đơn đồng thời không cùng nhận ưu đãi đơn đầu.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${dto.userId} FOR UPDATE`;
      }
      await this.checkFirstOrderVoucher(appliedPromotionCode || '', dto.userId, tx);
      // 6.1. KIỂM TRA VÀ TRỪ TỒN KHO NGUYÊN LIỆU TRONG TRANSACTION
      for (const [ingId, req] of requiredIngredientsMap.entries()) {
        const ing = await tx.ingredient.findUnique({ where: { id: ingId } });
        if (!ing) {
          throw new BadRequestException(`Không tìm thấy nguyên liệu: ${req.name}`);
        }

        const currentStock = Number(ing.currentStock);
        if (currentStock < req.requiredAmount) {
          const missing = req.requiredAmount - currentStock;
          throw new BadRequestException(
            `Không đủ nguyên liệu để pha chế: ${req.name} (cần ${req.requiredAmount} ${req.unit}, hiện chỉ còn ${currentStock} ${req.unit}, thiếu ${missing} ${req.unit})`,
          );
        }
      }

      // 6.2. OPTIMISTIC LOCKING PHIÊN BẢN SẢN PHẨM (Chống race-condition)
      for (const [pId] of requiredProductQtyMap.entries()) {
        const currentProd = productMap.get(pId)!;
        const updateResult = await tx.product.updateMany({
          where: {
            id: pId,
            version: currentProd.version,
          },
          data: {
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            `Xung đột dữ liệu khi khóa phiên bản món "${currentProd.name}". Vui lòng thử lại.`,
          );
        }
      }

      // 6.3. TRỪ ĐIỂM LOYALTY ĐÃ DÙNG
      if (pointsToDeduct > 0 && dto.userId) {
        await tx.user.update({
          where: { id: dto.userId },
          data: {
            loyaltyPoints: { decrement: pointsToDeduct },
          },
        });
      }

      // 6.4. SINH MÃ ĐƠN HÀNG
      const orderCode = await this.generateOrderCode(tx);

      // 6.5. TẠO BẢN GHI ĐƠN HÀNG
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
          pointsUsed: pointsToDeduct,
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

      // 6.6. NẾU ĐƠN HÀNG Ở TRẠNG THÁI PAID (THANH TOÁN TRỰC TIẾP TẠI QUẦY) -> TRỪ KHO NGAY
      // NẾU LÀ VNPAY (PENDING) -> CHỜ XÁC NHẬN THANH TOÁN QUA WEBHOOK MỚI TRỪ KHO ĐỂ KHÔNG GIỮ CHỖ
      if (order.status === 'PAID') {
        await this.deductOrderInventoryInTx(order.id, tx);
      }

      // 6.7. GHI NHẬT KÝ TRẠNG THÁI ĐƠN HÀNG
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'PENDING',
          reason: 'Khởi tạo đơn hàng mới',
          changedBy: dto.customerName,
        },
      });

      return order;
    });
  }

  /**
   * Lấy danh sách lịch sử đơn hàng của người dùng đang đăng nhập
   * GET /orders/me
   */
  async findMyOrders(userId: string) {
    if (!userId) {
      throw new BadRequestException('Không tìm thấy thông tin tài khoản người dùng');
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
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lấy danh sách đơn hàng có bộ lọc
   */
  async findAll(params: { status?: string; userId?: string; phone?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.userId) where.userId = params.userId;
    if (params.phone) where.phone = { contains: params.phone };

    return this.prisma.order.findMany({
      where,
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
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    return order;
  }

  /**
   * Tìm đơn hàng theo mã đơn (orderCode)
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
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
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
   * Lấy các trạng thái kế tiếp hợp lệ
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
   * Cập nhật trạng thái đơn hàng tuân thủ Order State Machine
   * Kèm logic hoàn kho nguyên liệu nếu CANCELLED & ghi OrderStatusHistory
   */
  async updateStatus(
    id: string,
    status: string,
    reason?: string,
    changedBy: string = 'SYSTEM',
  ) {
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

    return await this.prisma.$transaction(async (tx) => {
      // KHI THANH TOÁN THÀNH CÔNG (PAID):
      if (targetStatus === 'PAID' && currentStatus !== 'PAID') {
        // Trừ tồn kho nguyên liệu nếu chưa trừ
        if (!order.isInventoryDeducted) {
          await this.deductOrderInventoryInTx(order.id, tx);
        }
        // Tích điểm thưởng cho khách hàng nếu có
        if (order.userId && order.pointsEarned && order.pointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { increment: order.pointsEarned },
            },
          });
        }
      }

      // KHI HỦY ĐƠN HÀNG (CANCELLED):
      if (targetStatus === 'CANCELLED') {
        // HOÀN KHO NGUYÊN LIỆU THÔ (Restock Ingredients theo đúng BOM thực tế)
        const deductTxs = await tx.inventoryTransaction.findMany({
          where: {
            orderId: order.id,
            type: 'ORDER_DEDUCT',
          },
        });

        // Kiểm tra xem đã có giao dịch RESTOCK cho đơn này chưa (chống hoàn kho 2 lần)
        const restockCount = await tx.inventoryTransaction.count({
          where: {
            orderId: order.id,
            type: 'RESTOCK',
          },
        });

        if (order.isInventoryDeducted && restockCount === 0 && deductTxs.length > 0) {
          for (const dTx of deductTxs) {
            const ing = await tx.ingredient.findUnique({
              where: { id: dTx.ingredientId },
            });
            if (ing) {
              const returnQty = Math.abs(Number(dTx.quantity));
              const newStock = Number(ing.currentStock) + returnQty;

              await tx.ingredient.update({
                where: { id: ing.id },
                data: { currentStock: newStock },
              });

              await tx.inventoryTransaction.create({
                data: {
                  ingredientId: ing.id,
                  type: 'RESTOCK',
                  quantity: returnQty,
                  balanceAfter: newStock,
                  referenceType: 'ORDER',
                  orderId: order.id,
                  notes: `Hoàn kho nguyên liệu do hủy đơn hàng ${order.orderCode}`,
                },
              });
            }
          }

          await tx.order.update({
            where: { id: order.id },
            data: { isInventoryDeducted: false },
          });
        }

        // 3. Nếu đơn trước đó đã PAID và có tích điểm -> Thu hồi điểm
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

        // 4. Hoàn lại điểm tích lũy khách đã dùng (pointsUsed) nếu có
        if (order.userId && order.pointsUsed && order.pointsUsed > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { increment: order.pointsUsed },
            },
          });
        }
      }

      // Cập nhật trạng thái đơn hàng
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

      // Ghi nhật ký chuyển đổi trạng thái (OrderStatusHistory)
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: reason || `Cập nhật trạng thái sang ${targetStatus}`,
          changedBy,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Trừ tồn kho nguyên liệu theo công thức BOM trong Database Transaction với Khóa Pessimistic Locking
   * Chống Race condition & Double deduction
   */
  async deductOrderInventoryInTx(orderId: string, tx: Prisma.TransactionClient) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                recipes: {
                  include: { ingredient: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${orderId}"`);
    }

    // 1. Chống Double Deduction: Nếu đơn hàng đã trừ kho rồi thì bỏ qua ngay lập tức
    if (order.isInventoryDeducted) {
      return { alreadyDeducted: true, order };
    }

    // 2. Thu thập và cộng dồn nguyên liệu cần thiết theo công thức (BOM)
    const requiredMap = new Map<string, { id: string; name: string; unit: string; requiredAmount: number }>();

    for (const oi of order.orderItems) {
      const product = oi.product;
      const size = oi.size;

      let recipes = product.recipes.filter((r) => r.size === size);
      if (recipes.length === 0) {
        recipes = product.recipes.filter((r) => r.size === null);
      }
      if (recipes.length === 0 && product.recipes.length > 0) {
        recipes = product.recipes;
      }

      for (const r of recipes) {
        const amount = Number(r.amount);
        const wasteRate = Number((r as any).wasteRate || 0);
        const effectivePerCup = amount * (1 + wasteRate / 100);
        const needed = Math.round(effectivePerCup * oi.qty * 100) / 100;

        const existing = requiredMap.get(r.ingredientId);
        if (existing) {
          existing.requiredAmount = Math.round((existing.requiredAmount + needed) * 100) / 100;
        } else {
          requiredMap.set(r.ingredientId, {
            id: r.ingredientId,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            requiredAmount: needed,
          });
        }
      }
    }

    const ingredientIds = Array.from(requiredMap.keys());
    if (ingredientIds.length === 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { isInventoryDeducted: true, inventoryDeductedAt: new Date() },
      });
      return { alreadyDeducted: false, order };
    }

    // 3. Sắp xếp danh sách ID nguyên liệu tăng dần (ORDER BY id ASC)
    // Triệt tiêu 100% Deadlock khi nhiều transaction đồng thời khóa các tài nguyên trùng nhau
    const sortedIds = [...ingredientIds].sort();

    // 4. Khóa độc quyền (Exclusive Pessimistic Lock - SELECT FOR UPDATE)
    const lockedIngredients = await tx.$queryRaw<
      Array<{ id: string; current_stock: any; name: string }>
    >`
      SELECT id, current_stock, name
      FROM ingredients
      WHERE id IN (${Prisma.join(sortedIds)})
      ORDER BY id ASC
      FOR UPDATE
    `;

    const lockedMap = new Map(lockedIngredients.map((ing) => [ing.id, Number(ing.current_stock)]));

    // 5. Kiểm tra tồn kho thực tế dưới khóa
    for (const [ingId, req] of requiredMap.entries()) {
      const stock = lockedMap.get(ingId);
      if (stock === undefined || stock < req.requiredAmount) {
        const currentStock = stock ?? 0;
        const missing = Math.round((req.requiredAmount - currentStock) * 100) / 100;
        throw new BadRequestException(
          `Không đủ nguyên liệu trong kho để hoàn tất đơn hàng: ${req.name} (cần ${req.requiredAmount} ${req.unit}, hiện chỉ còn ${currentStock} ${req.unit}, thiếu ${missing} ${req.unit})`,
        );
      }
    }

    // 6. Thực hiện trừ kho thực tế và ghi nhận InventoryTransaction
    for (const [ingId, req] of requiredMap.entries()) {
      const oldStock = lockedMap.get(ingId)!;
      const newStock = Math.round((oldStock - req.requiredAmount) * 100) / 100;

      await tx.ingredient.update({
        where: { id: ingId },
        data: { currentStock: newStock },
      });

      await tx.inventoryTransaction.create({
        data: {
          ingredientId: ingId,
          type: 'ORDER_DEDUCT',
          quantity: -req.requiredAmount,
          balanceAfter: newStock,
          referenceType: 'ORDER',
          orderId: order.id,
          notes: `Trừ kho pha chế cho đơn hàng ${order.orderCode}`,
        },
      });
    }

    // 7. Cập nhật cờ isInventoryDeducted = true
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        isInventoryDeducted: true,
        inventoryDeductedAt: new Date(),
      },
    });

    return { alreadyDeducted: false, order: updatedOrder };
  }

  /**
   * Hủy đơn hàng (POST /orders/:id/cancel hoặc PATCH /orders/:id/cancel)
   * Tuân thủ quy tắc:
   * - CUSTOMER chỉ được hủy đơn của chính mình (chặn IDOR)
   * - Hủy đơn nếu "chưa làm": Chỉ được hủy khi đơn ở trạng thái PENDING, PAYMENT_FAILED, hoặc PAID
   *   Nếu đơn đã vào PREPARING, READY, hoặc COMPLETED -> Ném BadRequestException
   * - Hoàn kho BOM nguyên liệu nếu đã trừ kho
   * - Thu hồi điểm thưởng đã tích nếu có
   * - Hoàn lại điểm thưởng đã sử dụng (pointsUsed) nếu có
   */
  async cancelOrder(
    id: string,
    currentUserId?: string,
    userRole?: string,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    // 1. Chống IDOR: Khách hàng chỉ được hủy đơn của chính mình
    if (userRole === 'CUSTOMER' && order.userId && order.userId !== currentUserId) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn hàng của người khác');
    }

    // 2. Chặn hủy nếu đơn đã kết thúc
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng này đã được hủy trước đó.');
    }
    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã hoàn thành, không thể hủy đơn.');
    }

    // 3. Quy tắc "Hủy đơn nếu chưa làm":
    // Nếu không phải ADMIN, chỉ cho phép hủy khi đơn chưa bắt đầu pha chế (PENDING, PAYMENT_FAILED, PAID)
    const allowedCancelStatuses = ['PENDING', 'PAYMENT_FAILED', 'PAID'];
    if (userRole !== 'ADMIN' && !allowedCancelStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Đơn hàng đang ở trạng thái "${order.status}" (đã đưa vào pha chế hoặc sẵn sàng nhận), không thể hủy đơn hàng.`,
      );
    }

    const cancelReason =
      reason || (userRole === 'CUSTOMER' ? 'Khách hàng yêu cầu hủy đơn' : 'Nhân viên hủy đơn');
    const changedBy = currentUserId || userRole || 'CUSTOMER';

    return this.updateStatus(id, 'CANCELLED', cancelReason, changedBy);
  }
}
