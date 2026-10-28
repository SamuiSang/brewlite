import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { randomUUID } from 'crypto';
import { OrderStateMachine, OrderStatus } from '../orders/order-state-machine';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xử lý thanh toán đơn hàng kèm cơ chế Idempotency-Key (chống trừ tiền 2 lần)
   * và tích hợp Máy trạng thái đơn hàng (Order State Machine)
   */
  async processMockPayment(dto: CreatePaymentDto) {
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();

    // 1. Kiểm tra Idempotency Key (chặn trùng thanh toán nếu client gửi lại request)
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existingPayment) {
      const order = await this.prisma.order.findUnique({
        where: { id: existingPayment.orderId },
        include: {
          orderItems: {
            include: {
              product: true,
              toppings: { include: { topping: true } },
            },
          },
        },
      });

      return {
        message: 'Giao dịch đã được xử lý trước đó (Idempotent response)',
        success: existingPayment.status === 'SUCCESS',
        isIdempotent: true,
        payment: existingPayment,
        order,
      };
    }

    // 2. Tìm đơn hàng (hỗ trợ tìm theo UUID hoặc mã đơn như #1042)
    const normalizedCode = dto.orderId.startsWith('#')
      ? dto.orderId
      : `#${dto.orderId}`;

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: dto.orderId }, { orderCode: normalizedCode }],
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${dto.orderId}"`);
    }

    // Chặn thanh toán lại nếu đơn đã ở trạng thái PAID
    if (order.status === 'PAID') {
      throw new BadRequestException(
        'Đơn hàng này đã được thanh toán thành công trước đó',
      );
    }

    // Chặn thanh toán nếu đơn đã bị CANCELLED hoặc COMPLETED
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(
        'Đơn hàng này đã bị hủy, không thể tiến hành thanh toán',
      );
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException(
        'Đơn hàng này đã hoàn tất, không thể thanh toán lại',
      );
    }

    // 3. Xác định kết quả Mock Payment (mặc định là true nếu không truyền)
    const isSuccess = dto.mockSuccess !== undefined ? dto.mockSuccess : true;
    const paymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextOrderStatus: OrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    // Xác thực chuyển trạng thái đơn hàng qua Order State Machine
    OrderStateMachine.validateTransition(
      order.status as OrderStatus,
      nextOrderStatus,
    );

    // 4. Thực thi Transaction lưu Payment + Cập nhật Order status + Cộng điểm Loyalty
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: nextOrderStatus },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            'Trạng thái đơn vừa thay đổi. Vui lòng tải lại.',
          );

        // Tạo bản ghi Payment với Idempotency Key duy nhất
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            method: dto.method,
            status: paymentStatus,
            amount: order.totalAmount,
          },
        });

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: nextOrderStatus },
          include: {
            orderItems: {
              include: {
                product: true,
                toppings: { include: { topping: true } },
              },
            },
          },
        });

        // Nếu thanh toán thành công và có tài khoản User -> Cộng điểm Loyalty (10.000đ = 1 điểm)
        if (
          isSuccess &&
          order.userId &&
          order.pointsEarned &&
          order.pointsEarned > 0
        ) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { increment: order.pointsEarned },
            },
          });
        }

        return { payment, order: updatedOrder };
      });

      return {
        message: isSuccess
          ? 'Thanh toán thành công! Đơn hàng đã chuyển sang trạng thái PAID.'
          : 'Thanh toán thất bại! Đơn hàng chuyển sang trạng thái PAYMENT_FAILED.',
        success: isSuccess,
        isIdempotent: false,
        ...result,
      };
    } catch (error: any) {
      // Xử lý Race Condition: Nếu 2 request cùng idempotencyKey lọt qua findUnique đồng thời,
      // bản ghi thứ 2 sẽ bắn lỗi Unique Constraint (P2002) trên trường idempotency_key.
      // Bắt mã P2002 và trả về kết quả an toàn (Idempotent response) thay vì trả về lỗi 500!
      if (
        error?.code === 'P2002' ||
        (typeof error?.message === 'string' &&
          error.message.includes('idempotency_key'))
      ) {
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          const freshOrder = await this.prisma.order.findUnique({
            where: { id: existing.orderId },
            include: {
              orderItems: {
                include: {
                  product: true,
                  toppings: { include: { topping: true } },
                },
              },
            },
          });

          return {
            message:
              'Giao dịch đã được xử lý đồng thời trước đó (Idempotent response)',
            success: existing.status === 'SUCCESS',
            isIdempotent: true,
            payment: existing,
            order: freshOrder,
          };
        }
      }

      throw error;
    }
  }
}
