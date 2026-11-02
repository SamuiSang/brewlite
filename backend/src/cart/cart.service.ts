import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncCartDto } from './dto/sync-cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy giỏ hàng của người dùng hiện tại
   */
  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  basePrice: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    }

    return {
      id: cart.id,
      userId: cart.userId,
      items: cart.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        name: it.product.name,
        size: it.size,
        quantity: it.quantity,
        milk: it.milk,
        note: it.note,
        toppings: it.toppings ? JSON.parse(it.toppings) : [],
        basePrice: Number(it.product.basePrice),
        imageUrl: it.product.imageUrl,
      })),
    };
  }

  /**
   * Đồng bộ toàn bộ giỏ hàng của người dùng hiện tại
   */
  async syncCart(userId: string, dto: SyncCartDto) {
    return this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({ where: { userId } });
      if (!cart) {
        cart = await tx.cart.create({ data: { userId } });
      }

      // Xóa các món cũ trong giỏ của user này
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      // Thêm lại các món mới
      for (const item of dto.items) {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
            milk: item.milk || null,
            note: item.note || null,
            toppings: item.toppings ? JSON.stringify(item.toppings) : null,
          },
        });
      }

      return this.getCart(userId);
    });
  }

  /**
   * Xóa toàn bộ giỏ hàng của người dùng
   */
  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { message: 'Đã xóa toàn bộ giỏ hàng' };
  }
}

