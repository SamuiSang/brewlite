import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
   * Khởi tạo đơn hàng kèm Trừ tồn kho nguyên liệu thô bằng Optimistic Lock (Task 6 - Chiến)
   */
  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    // 1. Thu thập danh sách productId & toppingId
    const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const allToppingIds = Array.from(
      new Set(dto.items.flatMap((i) => i.toppingIds || [])),
    );

    // 2. Truy vấn dữ liệu thực tế từ CSDL kèm Recipe & Ingredient
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
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

    // 3. Tính toán tổng lượng nguyên vật liệu thô cần dùng cho cả đơn hàng
    const requiredIngredientMap = new Map<
      string,
      { ingredient: any; requiredAmount: number }
    >();

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      for (const recipe of product.recipeItems) {
        const ingId = recipe.ingredientId;
        const needed = recipe.amount * item.qty;
        const existing = requiredIngredientMap.get(ingId);
        if (existing) {
          existing.requiredAmount += needed;
        } else {
          requiredIngredientMap.set(ingId, {
            ingredient: recipe.ingredient,
            requiredAmount: needed,
          });
        }
      }
    }

    // 4. Kiểm tra tồn kho nguyên vật liệu trước khi tạo đơn
    for (const [ingId, { ingredient, requiredAmount }] of requiredIngredientMap.entries()) {
      if (ingredient.stock < requiredAmount) {
        throw new BadRequestException(
          `Nguyên liệu "${ingredient.name}" không đủ để pha chế (tồn kho: ${ingredient.stock} ${ingredient.unit}, yêu cầu: ${requiredAmount} ${ingredient.unit})`,
        );
      }
    }

    // 5. Tính toán chi tiết từng món trong đơn (subtotal)
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

    // 6. Kiểm tra và áp dụng mã khuyến mãi (nếu có)
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

      discountAmount = Math.min(discountAmount, calculatedSubtotal);
      appliedPromotionCode = promotion.code;
    }

    const totalAmount = Math.max(0, calculatedSubtotal - discountAmount);
    const pointsEarned = Math.floor(totalAmount / 10000);

    // 7. Thực thi Transaction nguyên tử: Trừ tồn kho nguyên liệu bằng Optimistic Lock & Lưu đơn
    return await this.prisma.$transaction(async (tx) => {
      // 7.1. Trừ tồn kho nguyên liệu thô kèm Optimistic Lock (version check)
      for (const [ingId, { ingredient, requiredAmount }] of requiredIngredientMap.entries()) {
        const currentIng = await tx.ingredient.findUnique({
          where: { id: ingId },
        });

        if (!currentIng || currentIng.stock < requiredAmount) {
          throw new BadRequestException(
            `Nguyên liệu "${ingredient.name}" đã hết hoặc không đủ tồn kho để đáp ứng đơn hàng`,
          );
        }

        const updateResult = await tx.ingredient.updateMany({
          where: {
            id: ingId,
            version: currentIng.version,
            stock: { gte: requiredAmount },
          },
          data: {
            stock: { decrement: requiredAmount },
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            `Xung đột dữ liệu khi trừ tồn kho nguyên liệu "${ingredient.name}". Phiên bản đã thay đổi do giao dịch đồng thời.`,
          );
        }
      }

      // 7.2. Sinh mã đơn hàng
      const orderCode = await this.generateOrderCode(tx);

      // 7.3. Tạo đơn hàng
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
            product: {
              include: {
                recipeItems: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
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
   * Cập nhật trạng thái đơn hàng (Task 6 & Task 10.1 - Chiến)
   * Khi hủy đơn hàng (CANCELLED): Tự động hoàn lại số lượng nguyên liệu thô vào Ingredient.stock
   */
  async updateStatus(id: string, status: string) {
    const validStatuses = ['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    const upperStatus = status.toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      throw new BadRequestException(
        `Trạng thái "${status}" không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                recipeItems: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID "${id}"`);
    }

    if (order.status === upperStatus) {
      return this.findOne(id);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Khi hủy đơn (CANCELLED): Hoàn trả nguyên liệu thô vào bảng Ingredient
      if (upperStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
        const refundIngredientMap = new Map<string, number>();

        for (const item of order.orderItems) {
          if (item.product && item.product.recipeItems) {
            for (const recipe of item.product.recipeItems) {
              const refundQty = recipe.amount * item.qty;
              const current = refundIngredientMap.get(recipe.ingredientId) || 0;
              refundIngredientMap.set(recipe.ingredientId, current + refundQty);
            }
          }
        }

        for (const [ingId, refundQty] of refundIngredientMap.entries()) {
          await tx.ingredient.update({
            where: { id: ingId },
            data: {
              stock: { increment: refundQty },
              version: { increment: 1 },
            },
          });
        }
      }

      return tx.order.update({
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
    });
  }
}
