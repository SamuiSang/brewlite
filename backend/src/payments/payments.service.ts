import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async processMockPayment(dto: CreatePaymentDto) {
    // 1. Tìm đơn hàng (hỗ trợ tìm theo UUID hoặc orderCode như #1042)
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

    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó');
    }

    const idempotencyKey = dto.idempotencyKey || randomUUID();

    // 2. Kiểm tra Idempotency Key (chặn trừ tiền 2 lần nếu gửi trùng request)
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existingPayment) {
      return {
        message: 'Giao dịch đã được xử lý trước đó',
        payment: existingPayment,
      };
    }

    // 3. Xác định kết quả Mock Payment (mặc định là true nếu không truyền)
    const isSuccess = dto.mockSuccess !== undefined ? dto.mockSuccess : true;
    const paymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextOrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    // 4. Dùng Transaction để lưu Payment + Cập nhật trạng thái Order + Cộng điểm User
    const result = await this.prisma.$transaction(async (tx) => {
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
            include: { product: true, toppings: { include: { topping: true } } },
          },
        },
      });

      // Nếu thanh toán thành công và đơn có gắn userId -> Cộng điểm tích lũy
      if (isSuccess && order.userId && order.pointsEarned && order.pointsEarned > 0) {
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
      ...result,
    };
  }
}