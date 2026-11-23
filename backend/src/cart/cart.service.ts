import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import {
  AddCartItemDto,
  CartItemDto,
  CheckoutCartDto,
  SyncCartDto,
  UpdateCartItemDto,
  UpdateCartItemQuantityDto,
} from './dto/sync-cart.dto';

const POINT_TO_VND_RATE = 1000;
const MAX_ITEM_QTY = 9999;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly ordersService: OrdersService,
  ) {}

  private readonly cartInclude = {
    items: {
      orderBy: { createdAt: 'asc' as const },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
    },
  };

  private parseToppingsJson(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private normalizeToppings(toppings?: string[]): string[] {
    if (!toppings || toppings.length === 0) return [];
    return [...toppings].sort();
  }

  private isSameItemConfig(
    existing: {
      productId: string;
      size: string;
      milk: string | null;
      note: string | null;
      toppings: string | null;
    },
    candidate: {
      productId: string;
      size: string;
      milk?: string | null;
      note?: string | null;
      toppings?: string[];
    },
  ): boolean {
    const existingToppings = this.normalizeToppings(
      this.parseToppingsJson(existing.toppings),
    );
    const candidateToppings = this.normalizeToppings(candidate.toppings);
    return (
      existing.productId === candidate.productId &&
      existing.size === candidate.size &&
      (existing.milk || null) === (candidate.milk || null) &&
      (existing.note || null) === (candidate.note || null) &&
      JSON.stringify(existingToppings) === JSON.stringify(candidateToppings)
    );
  }

  private async ensureCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: this.cartInclude,
      });
    }

    return cart;
  }

  private async validateProductsAndToppings(
    productIds: string[],
    toppingIds: string[],
  ) {
    const uniqueProductIds = Array.from(new Set(productIds));
    if (uniqueProductIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: uniqueProductIds } },
        select: { id: true, name: true, isActive: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      for (const pId of uniqueProductIds) {
        const prod = productMap.get(pId);
        if (!prod) {
          throw new NotFoundException(`Không tìm thấy sản phẩm "${pId}"`);
        }
        if (!prod.isActive) {
          throw new BadRequestException(
            `Sản phẩm "${prod.name}" hiện đã ngừng bán`,
          );
        }
      }
    }

    const uniqueToppingIds = Array.from(new Set(toppingIds));
    if (uniqueToppingIds.length > 0) {
      const toppings = await this.prisma.topping.findMany({
        where: { id: { in: uniqueToppingIds } },
        select: { id: true, name: true, isAvailable: true },
      });
      const toppingMap = new Map(toppings.map((t) => [t.id, t]));
      for (const tId of uniqueToppingIds) {
        const top = toppingMap.get(tId);
        if (!top) {
          throw new NotFoundException(`Không tìm thấy topping "${tId}"`);
        }
        if (!top.isAvailable) {
          throw new BadRequestException(
            `Topping "${top.name}" hiện tạm hết hàng`,
          );
        }
      }
    }
  }

  private async buildCartResponse(cart: any) {
    const allToppingIds = Array.from(
      new Set<string>(
        cart.items.flatMap((it: any) => this.parseToppingsJson(it.toppings)),
      ),
    );

    const toppings =
      allToppingIds.length > 0
        ? await this.prisma.topping.findMany({
            where: { id: { in: allToppingIds } },
          })
        : [];
    const toppingMap = new Map(toppings.map((t) => [t.id, t]));

    let totalItems = 0;
    let subtotal = 0;

    const enrichedItems = cart.items.map((it: any) => {
      const toppingIds = this.parseToppingsJson(it.toppings);
      const toppingDetails = toppingIds
        .map((id) => toppingMap.get(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .map((t) => ({
          id: t.id,
          name: t.name,
          price: Number(t.price),
        }));

      const basePrice = Number(it.product.basePrice);
      const sizeExtraPrice = this.ordersService.getSizeExtraPrice(
        (it.size as 'S' | 'M' | 'L') || 'M',
      );
      const toppingsPrice = toppingDetails.reduce((s, t) => s + t.price, 0);
      const unitPrice = basePrice + sizeExtraPrice + toppingsPrice;
      const lineTotal = unitPrice * it.quantity;

      totalItems += it.quantity;
      subtotal += lineTotal;

      return {
        id: it.id,
        productId: it.productId,
        name: it.product.name,
        size: it.size,
        quantity: it.quantity,
        milk: it.milk,
        note: it.note,
        toppings: toppingIds,
        toppingDetails,
        basePrice,
        sizeExtraPrice,
        toppingsPrice,
        unitPrice,
        lineTotal,
        imageUrl: it.product.imageUrl,
        isActive: it.product.isActive,
      };
    });

    const user = await this.prisma.user.findUnique({
      where: { id: cart.userId },
      select: { loyaltyPoints: true },
    });
    const availableLoyaltyPoints = Number(user?.loyaltyPoints ?? 0);

    let appliedVoucher: any = null;
    let voucherDiscount = 0;
    let voucherError: string | null = null;

    if (cart.voucherCode && subtotal > 0) {
      try {
        const validated = await this.ordersService.validateVoucher(
          { code: cart.voucherCode, subtotal },
          cart.userId,
        );
        appliedVoucher = {
          code: validated.code,
          discountType: validated.discountType,
          discountValue: validated.discountValue,
          minOrderAmount: validated.minOrderAmount,
          maxDiscountAmount: validated.maxDiscountAmount,
        };
        voucherDiscount = validated.discountAmount;
      } catch (err: any) {
        voucherError = err?.message || 'Mã khuyến mãi không còn hợp lệ';
      }
    }

    const useLoyaltyPoints = Boolean(cart.useLoyaltyPoints);
    let pointsUsed = 0;
    let pointsDiscount = 0;
    if (useLoyaltyPoints && availableLoyaltyPoints > 0 && subtotal > voucherDiscount) {
      const maxAllowedDiscount = Math.max(0, subtotal - voucherDiscount);
      const maxPointsDiscount = availableLoyaltyPoints * POINT_TO_VND_RATE;
      pointsDiscount = Math.min(maxPointsDiscount, maxAllowedDiscount);
      pointsUsed = Math.ceil(pointsDiscount / POINT_TO_VND_RATE);
      pointsDiscount = Math.min(pointsUsed * POINT_TO_VND_RATE, maxAllowedDiscount);
    }

    const totalDiscount = voucherDiscount + pointsDiscount;
    const finalTotal = Math.max(0, subtotal - totalDiscount);
    const estimatedPointsEarned = Math.floor(finalTotal / 10000);

    return {
      id: cart.id,
      userId: cart.userId,
      voucherCode: cart.voucherCode || null,
      useLoyaltyPoints,
      items: enrichedItems,
      summary: {
        totalItems,
        subtotal,
        appliedVoucher,
        voucherDiscount,
        voucherError,
        availableLoyaltyPoints,
        useLoyaltyPoints,
        pointsUsed,
        pointsDiscount,
        totalDiscount,
        finalTotal,
        estimatedPointsEarned,
      },
    };
  }

  /**
   * GET /cart - Lấy toàn bộ giỏ hàng kèm giá tính toán và tóm tắt
   */
  async getCart(userId: string) {
    const cart = await this.ensureCart(userId);
    return this.buildCartResponse(cart);
  }

  /**
   * GET /cart/summary - Lấy tóm tắt giỏ hàng kèm kiểm tra BOM tồn kho thực tế
   */
  async getCartSummary(userId: string) {
    const cartResponse = await this.getCart(userId);
    const validation = await this.inventoryService.validateCart({
      items: cartResponse.items.map((it: any) => ({
        productId: it.productId,
        size: it.size,
        quantity: it.quantity,
      })),
    });

    const canCheckout =
      cartResponse.items.length > 0 && Boolean(validation.isValid);

    return {
      ...cartResponse.summary,
      canCheckout,
      validation,
    };
  }

  /**
   * POST /cart/items - Thêm 1 món vào giỏ (gộp số lượng nếu cấu hình trùng khớp)
   */
  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm "${dto.productId}"`);
    }
    if (!product.isActive) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" hiện đã ngừng bán`,
      );
    }

    const toppingIds = this.normalizeToppings(dto.toppings);
    if (toppingIds.length > 0) {
      await this.validateProductsAndToppings([], toppingIds);
    }

    const size = dto.size || 'M';
    const quantity = dto.quantity ?? 1;
    const milk = dto.milk || null;
    const note = dto.note || null;

    const cart = await this.ensureCart(userId);
    const existingItem = cart.items.find((it) =>
      this.isSameItemConfig(it, {
        productId: dto.productId,
        size,
        milk,
        note,
        toppings: toppingIds,
      }),
    );

    let targetItemId: string;
    if (existingItem) {
      const nextQty = Math.min(existingItem.quantity + quantity, MAX_ITEM_QTY);
      const updated = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQty },
      });
      targetItemId = updated.id;
    } else {
      const created = await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          size,
          quantity: Math.min(quantity, MAX_ITEM_QTY),
          milk,
          note,
          toppings: toppingIds.length > 0 ? JSON.stringify(toppingIds) : null,
        },
      });
      targetItemId = created.id;
    }

    const updatedCart = await this.getCart(userId);
    return {
      message: 'Đã thêm món vào giỏ hàng',
      lastAddedItemId: targetItemId,
      ...updatedCart,
    };
  }

  /**
   * GET /cart/items/:itemId - Lấy chi tiết 1 món trong giỏ hàng
   */
  async getItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: { select: { userId: true } },
        product: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy món "${itemId}" trong giỏ hàng`);
    }

    const cartResponse = await this.getCart(userId);
    const enriched = cartResponse.items.find((it: any) => it.id === itemId);
    if (!enriched) {
      throw new NotFoundException(`Không tìm thấy món "${itemId}" trong giỏ hàng`);
    }

    return enriched;
  }

  /**
   * PATCH /cart/items/:itemId - Cập nhật thông tin 1 món trong giỏ
   */
  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });

    if (!existing || existing.cart.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy món "${itemId}" trong giỏ hàng`);
    }

    let normalizedToppings: string[] | undefined;
    if (dto.toppings !== undefined) {
      normalizedToppings = this.normalizeToppings(dto.toppings);
      await this.validateProductsAndToppings([], normalizedToppings);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        ...(dto.size !== undefined ? { size: dto.size } : {}),
        ...(dto.quantity !== undefined
          ? { quantity: Math.min(dto.quantity, MAX_ITEM_QTY) }
          : {}),
        ...(dto.milk !== undefined ? { milk: dto.milk || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note || null } : {}),
        ...(normalizedToppings !== undefined
          ? {
              toppings:
                normalizedToppings.length > 0
                  ? JSON.stringify(normalizedToppings)
                  : null,
            }
          : {}),
      },
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: 'Cập nhật món trong giỏ hàng thành công',
      ...updatedCart,
    };
  }

  /**
   * PATCH /cart/items/:itemId/quantity - Tăng/giảm hoặc đặt nhanh số lượng món
   */
  async updateItemQuantity(
    userId: string,
    itemId: string,
    dto: UpdateCartItemQuantityDto,
  ) {
    if (dto.quantity === undefined && dto.delta === undefined) {
      throw new BadRequestException(
        'Vui lòng truyền "quantity" hoặc "delta" để cập nhật số lượng',
      );
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });

    if (!existing || existing.cart.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy món "${itemId}" trong giỏ hàng`);
    }

    const nextQuantity =
      dto.quantity !== undefined
        ? dto.quantity
        : existing.quantity + (dto.delta ?? 0);

    if (nextQuantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      const updatedCart = await this.getCart(userId);
      return {
        message: 'Đã xóa món khỏi giỏ hàng do số lượng bằng 0',
        removedItemId: itemId,
        ...updatedCart,
      };
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: Math.min(nextQuantity, MAX_ITEM_QTY) },
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: 'Cập nhật số lượng món thành công',
      ...updatedCart,
    };
  }

  /**
   * DELETE /cart/items/:itemId - Xóa 1 món cụ thể khỏi giỏ hàng
   */
  async removeItem(userId: string, itemId: string) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });

    if (!existing || existing.cart.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy món "${itemId}" trong giỏ hàng`);
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    const updatedCart = await this.getCart(userId);
    return {
      message: 'Đã xóa món khỏi giỏ hàng',
      deletedItemId: itemId,
      ...updatedCart,
    };
  }

  /**
   * PUT /cart - Đồng bộ (thay thế) toàn bộ giỏ hàng của người dùng hiện tại
   */
  async syncCart(userId: string, dto: SyncCartDto) {
    await this.validateProductsAndToppings(
      dto.items.map((i) => i.productId),
      dto.items.flatMap((i) => i.toppings || []),
    );

    await this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({ where: { userId } });
      if (!cart) {
        cart = await tx.cart.create({ data: { userId } });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      for (const item of dto.items) {
        const toppings = this.normalizeToppings(item.toppings);
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            size: item.size,
            quantity: Math.min(item.quantity, MAX_ITEM_QTY),
            milk: item.milk || null,
            note: item.note || null,
            toppings: toppings.length > 0 ? JSON.stringify(toppings) : null,
          },
        });
      }
    });

    return this.getCart(userId);
  }

  /**
   * POST /cart/merge - Gộp giỏ hàng tạm (guest) vào giỏ hàng tài khoản
   */
  async mergeCart(userId: string, dto: SyncCartDto) {
    if (!dto.items || dto.items.length === 0) {
      return this.getCart(userId);
    }

    await this.validateProductsAndToppings(
      dto.items.map((i) => i.productId),
      dto.items.flatMap((i) => i.toppings || []),
    );

    await this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });
      if (!cart) {
        cart = await tx.cart.create({
          data: { userId },
          include: { items: true },
        });
      }

      const currentItems = [...cart.items];

      for (const incoming of dto.items) {
        const normalizedToppings = this.normalizeToppings(incoming.toppings);
        const match = currentItems.find((existing) =>
          this.isSameItemConfig(existing, {
            productId: incoming.productId,
            size: incoming.size,
            milk: incoming.milk || null,
            note: incoming.note || null,
            toppings: normalizedToppings,
          }),
        );

        if (match) {
          const nextQty = Math.min(
            match.quantity + incoming.quantity,
            MAX_ITEM_QTY,
          );
          await tx.cartItem.update({
            where: { id: match.id },
            data: { quantity: nextQty },
          });
          match.quantity = nextQty;
        } else {
          const created = await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: incoming.productId,
              size: incoming.size,
              quantity: Math.min(incoming.quantity, MAX_ITEM_QTY),
              milk: incoming.milk || null,
              note: incoming.note || null,
              toppings:
                normalizedToppings.length > 0
                  ? JSON.stringify(normalizedToppings)
                  : null,
            },
          });
          currentItems.push(created);
        }
      }
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: 'Đã gộp giỏ hàng thành công',
      ...updatedCart,
    };
  }

  /**
   * POST /cart/validate - Kiểm tra toàn bộ giỏ hàng hiện tại theo BOM tồn kho
   */
  async validateCart(userId: string) {
    const cartResponse = await this.getCart(userId);
    const validation = await this.inventoryService.validateCart({
      items: cartResponse.items.map((it: any) => ({
        productId: it.productId,
        size: it.size,
        quantity: it.quantity,
      })),
    });

    return {
      ...validation,
      canCheckout: cartResponse.items.length > 0 && Boolean(validation.isValid),
      summary: cartResponse.summary,
    };
  }

  /**
   * POST /cart/voucher - Áp dụng mã voucher vào giỏ hàng hiện tại
   */
  async applyVoucher(userId: string, code: string) {
    const cartResponse = await this.getCart(userId);
    if (cartResponse.items.length === 0) {
      throw new BadRequestException(
        'Giỏ hàng đang trống, vui lòng thêm món trước khi áp dụng mã giảm giá',
      );
    }

    const validated = await this.ordersService.validateVoucher(
      { code, subtotal: cartResponse.summary.subtotal },
      userId,
    );

    await this.prisma.cart.update({
      where: { id: cartResponse.id },
      data: { voucherCode: validated.code },
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: `Áp dụng mã voucher "${validated.code}" thành công`,
      ...updatedCart,
    };
  }

  /**
   * DELETE /cart/voucher - Gỡ mã voucher khỏi giỏ hàng
   */
  async removeVoucher(userId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { voucherCode: null },
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: 'Đã gỡ mã voucher khỏi giỏ hàng',
      ...updatedCart,
    };
  }

  /**
   * PATCH /cart/loyalty - Bật / tắt sử dụng điểm thưởng Loyalty trên giỏ hàng
   */
  async toggleLoyalty(userId: string, useLoyaltyPoints: boolean) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { useLoyaltyPoints },
    });

    const updatedCart = await this.getCart(userId);
    return {
      message: useLoyaltyPoints
        ? 'Đã bật sử dụng điểm thưởng Loyalty cho giỏ hàng'
        : 'Đã tắt sử dụng điểm thưởng Loyalty',
      ...updatedCart,
    };
  }

  /**
   * POST /cart/checkout - Tạo đơn hàng trực tiếp từ giỏ hàng hiện tại và xóa sạch giỏ sau khi đặt thành công
   */
  async checkout(userId: string, dto: CheckoutCartDto) {
    const cartResponse = await this.getCart(userId);
    if (cartResponse.items.length === 0) {
      throw new BadRequestException('Giỏ hàng trống, không thể đặt hàng');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        loyaltyPoints: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản');
    }

    const customerName =
      dto.customerName?.trim() || user.fullName || user.email;
    const phone = dto.phone?.trim() || user.phone || '';
    if (!phone) {
      throw new BadRequestException(
        'Vui lòng cung cấp số điện thoại nhận hàng',
      );
    }

    const promotionCode =
      dto.promotionCode !== undefined
        ? dto.promotionCode.trim().toUpperCase() || undefined
        : cartResponse.voucherCode || undefined;

    let pointsToUse = 0;
    if (dto.useLoyaltyPoints !== undefined) {
      pointsToUse = dto.useLoyaltyPoints;
    } else if (cartResponse.useLoyaltyPoints) {
      pointsToUse = cartResponse.summary.pointsUsed;
    }

    const order = await this.ordersService.createOrder({
      userId,
      customerName,
      phone,
      deliveryAddress: dto.deliveryAddress,
      notes: dto.notes,
      promotionCode,
      useLoyaltyPoints: pointsToUse,
      items: cartResponse.items.map((it: any) => ({
        productId: it.productId,
        size: it.size,
        qty: it.quantity,
        toppingIds: it.toppings,
      })),
    });

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cartResponse.id },
    });
    await this.prisma.cart.update({
      where: { id: cartResponse.id },
      data: { voucherCode: null, useLoyaltyPoints: false },
    });

    return {
      message: 'Đặt hàng từ giỏ hàng thành công',
      cartCleared: true,
      order,
    };
  }

  /**
   * DELETE /cart - Xóa toàn bộ giỏ hàng của người dùng
   */
  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { voucherCode: null, useLoyaltyPoints: false },
      });
    }
    return { message: 'Đã xóa toàn bộ giỏ hàng', items: [] };
  }
}
