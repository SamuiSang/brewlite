import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';

describe('CartService (Full Cart API)', () => {
  let service: CartService;
  let prisma: any;
  let inventoryService: any;
  let ordersService: any;

  const userId = 'user-1';
  const productA = {
    id: 'prod-1',
    name: 'Cà phê sữa đá',
    basePrice: new Prisma.Decimal(29000),
    imageUrl: 'https://example.com/coffee.jpg',
    isActive: true,
  };
  const toppingA = {
    id: 'top-1',
    name: 'Trân châu đen',
    price: new Prisma.Decimal(10000),
    isAvailable: true,
  };

  beforeEach(async () => {
    prisma = {
      cart: {
        findUnique: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      cartItem: {
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        delete: jest.fn<any>(),
        deleteMany: jest.fn<any>(),
      },
      product: {
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
      },
      topping: {
        findMany: jest.fn<any>(),
      },
      user: {
        findUnique: jest.fn<any>().mockResolvedValue({
          id: userId,
          fullName: 'Nguyễn Văn A',
          phone: '0903334444',
          email: 'khachhang@gmail.com',
          loyaltyPoints: 50,
        }),
      },
      $transaction: jest.fn<any>(async (cb: any) => cb(prisma)),
    };

    inventoryService = {
      validateCart: jest.fn<any>().mockResolvedValue({
        isValid: true,
        items: [],
        insufficientIngredients: [],
      }),
    };

    ordersService = {
      getSizeExtraPrice: jest.fn((size: 'S' | 'M' | 'L') =>
        size === 'M' ? 5000 : size === 'L' ? 10000 : 0,
      ),
      validateVoucher: jest.fn<any>().mockResolvedValue({
        code: 'GIAM20K',
        discountType: 'FIXED_AMOUNT',
        discountValue: 20000,
        discountAmount: 20000,
        finalAmount: 68000,
      }),
      createOrder: jest.fn<any>().mockResolvedValue({
        id: 'order-1',
        orderCode: '#1042',
        status: 'PENDING',
        totalAmount: 68000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('getCart enriches items with size extra, topping details, unitPrice, lineTotal, and summary', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      userId,
      voucherCode: null,
      useLoyaltyPoints: true,
      items: [
        {
          id: 'item-1',
          cartId: 'cart-1',
          productId: productA.id,
          size: 'M',
          quantity: 2,
          milk: 'Sữa đặc',
          note: 'Ít đá',
          toppings: JSON.stringify([toppingA.id]),
          product: productA,
        },
      ],
    });
    prisma.topping.findMany.mockResolvedValue([toppingA]);

    const res: any = await service.getCart(userId);

    // 29000 + 5000 (size M) + 10000 (topping) = 44000 / cup; 2 cups = 88000
    expect(res.items[0].unitPrice).toBe(44000);
    expect(res.items[0].lineTotal).toBe(88000);
    expect(res.items[0].toppingDetails).toEqual([
      { id: toppingA.id, name: toppingA.name, price: 10000 },
    ]);
    expect(res.summary.totalItems).toBe(2);
    expect(res.summary.subtotal).toBe(88000);
    // 50 points = 50000 discount -> finalTotal 38000
    expect(res.summary.pointsUsed).toBe(50);
    expect(res.summary.pointsDiscount).toBe(50000);
    expect(res.summary.finalTotal).toBe(38000);
  });

  it('addItem throws NotFoundException if product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.addItem(userId, {
        productId: 'non-existent',
        size: 'M',
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('addItem merges quantity when identical configuration already exists in cart', async () => {
    prisma.product.findUnique.mockResolvedValue(productA);
    prisma.topping.findMany.mockResolvedValue([toppingA]);
    prisma.cart.findUnique
      .mockResolvedValueOnce({
        id: 'cart-1',
        userId,
        voucherCode: null,
        useLoyaltyPoints: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: productA.id,
            size: 'M',
            quantity: 1,
            milk: null,
            note: null,
            toppings: JSON.stringify([toppingA.id]),
            product: productA,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'cart-1',
        userId,
        voucherCode: null,
        useLoyaltyPoints: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: productA.id,
            size: 'M',
            quantity: 3,
            milk: null,
            note: null,
            toppings: JSON.stringify([toppingA.id]),
            product: productA,
          },
        ],
      });
    prisma.cartItem.update.mockResolvedValue({ id: 'item-1', quantity: 3 });

    const res: any = await service.addItem(userId, {
      productId: productA.id,
      size: 'M',
      quantity: 2,
      toppings: [toppingA.id],
    });

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 3 },
    });
    expect(res.lastAddedItemId).toBe('item-1');
  });

  it('getItem throws NotFoundException when item belongs to another user (IDOR check)', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-other',
      cart: { userId: 'other-user' },
      product: productA,
    });

    await expect(service.getItem(userId, 'item-other')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateItemQuantity deletes item when delta reduces quantity to 0 or below', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-1',
      quantity: 1,
      cart: { userId },
    });
    prisma.cartItem.delete.mockResolvedValue({ id: 'item-1' });
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      userId,
      voucherCode: null,
      useLoyaltyPoints: false,
      items: [],
    });

    const res: any = await service.updateItemQuantity(userId, 'item-1', {
      delta: -1,
    });

    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(res.removedItemId).toBe('item-1');
  });

  it('applyVoucher throws BadRequestException when cart is empty', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      userId,
      voucherCode: null,
      useLoyaltyPoints: false,
      items: [],
    });

    await expect(service.applyVoucher(userId, 'GIAM20K')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('checkout creates order from DB cart and clears cart items & flags', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      userId,
      voucherCode: 'GIAM20K',
      useLoyaltyPoints: true,
      items: [
        {
          id: 'item-1',
          cartId: 'cart-1',
          productId: productA.id,
          size: 'M',
          quantity: 2,
          milk: null,
          note: null,
          toppings: JSON.stringify([toppingA.id]),
          product: productA,
        },
      ],
    });
    prisma.topping.findMany.mockResolvedValue([toppingA]);

    const res: any = await service.checkout(userId, {
      deliveryAddress: '123 Nguyễn Văn Cừ',
    });

    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        customerName: 'Nguyễn Văn A',
        phone: '0903334444',
        promotionCode: 'GIAM20K',
        items: [
          {
            productId: productA.id,
            size: 'M',
            qty: 2,
            toppingIds: [toppingA.id],
          },
        ],
      }),
    );
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { voucherCode: null, useLoyaltyPoints: false },
    });
    expect(res.cartCleared).toBe(true);
    expect(res.order.id).toBe('order-1');
  });
});
