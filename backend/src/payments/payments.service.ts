import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, PaymentWebhookDto } from './dto/create-payment.dto';
import { randomUUID } from 'crypto';
import { OrderStateMachine, OrderStatus } from '../orders/order-state-machine';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xử lý thanh toán đơn hàng:
   * - Bước 1 (twoStep: true): Tạo bản ghi Payment ở trạng thái PENDING, giữ nguyên Order = PENDING,
   *   trả về mã giao dịch và mã QR Sandbox để khách quét mã.
   * - 1-step (twoStep: false/undefined): Xử lý thanh toán trực tiếp (giả lập / mock) và cập nhật Order.
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
            include: { product: true, toppings: { include: { topping: true } } },
          },
        },
      });

      const qrPayload = `brewlite://sandbox-pay?paymentId=${existingPayment.id}&amount=${existingPayment.amount.toString()}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

      return {
        message: 'Giao dịch đã được xử lý trước đó (Idempotent response)',
        success: existingPayment.status === 'SUCCESS',
        isIdempotent: true,
        twoStep: dto.twoStep ?? (existingPayment.status === 'PENDING'),
        paymentId: existingPayment.id,
        transactionRef: `SANDBOX_${existingPayment.id.slice(0, 8).toUpperCase()}`,
        qrPayload,
        qrCodeUrl,
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
      throw new BadRequestException('Đơn hàng này đã được thanh toán thành công trước đó');
    }

    // Chặn thanh toán nếu đơn đã bị CANCELLED hoặc COMPLETED
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng này đã bị hủy, không thể tiến hành thanh toán');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng này đã hoàn tất, không thể thanh toán lại');
    }

    // 3. Xử lý Thanh toán 2 bước (Bước 1: Khởi tạo Payment PENDING + sinh mã QR Sandbox)
    if (dto.twoStep === true) {
      try {
        const payment = await this.prisma.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            method: dto.method,
            status: 'PENDING',
            amount: order.totalAmount,
          },
        });

        const transactionRef = `SANDBOX_${payment.id.slice(0, 8).toUpperCase()}`;
        const qrPayload = `brewlite://sandbox-pay?paymentId=${payment.id}&orderCode=${encodeURIComponent(order.orderCode)}&amount=${order.totalAmount.toString()}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

        return {
          message: 'Khởi tạo giao dịch thanh toán thành công (Bước 1: Chờ quét mã QR / Webhook callback từ cổng Sandbox).',
          success: true,
          twoStep: true,
          isIdempotent: false,
          paymentId: payment.id,
          orderId: order.id,
          orderCode: order.orderCode,
          amount: Number(order.totalAmount),
          transactionRef,
          qrPayload,
          qrCodeUrl,
          payment,
          order,
        };
      } catch (error: any) {
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

            const qrPayload = `brewlite://sandbox-pay?paymentId=${existing.id}&amount=${existing.amount.toString()}`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

            return {
              message: 'Giao dịch đã được xử lý đồng thời trước đó (Idempotent response)',
              success: existing.status === 'SUCCESS' || existing.status === 'PENDING',
              isIdempotent: true,
              twoStep: true,
              paymentId: existing.id,
              transactionRef: `SANDBOX_${existing.id.slice(0, 8).toUpperCase()}`,
              qrPayload,
              qrCodeUrl,
              payment: existing,
              order: freshOrder,
            };
          }
        }

        throw error;
      }
    }

    // 4. Thanh toán 1 bước truyền thống (cho các test cũ / thanh toán trực tiếp)
    const isSuccess = dto.mockSuccess !== undefined ? dto.mockSuccess : true;
    const paymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextOrderStatus: OrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    // Xác thực chuyển trạng thái đơn hàng qua Order State Machine
    OrderStateMachine.validateTransition(
      order.status as OrderStatus,
      nextOrderStatus,
    );

    try {
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
        twoStep: false,
        ...result,
      };
    } catch (error: any) {
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
            message: 'Giao dịch đã được xử lý đồng thời trước đó (Idempotent response)',
            success: existing.status === 'SUCCESS',
            isIdempotent: true,
            twoStep: false,
            payment: existing,
            order: freshOrder,
          };
        }
      }

      throw error;
    }
  }

  /**
   * Bước 2: Webhook callback từ Cổng thanh toán Sandbox (POST /payments/webhook)
   * - Xác nhận kết quả thanh toán từ Cổng Sandbox (SUCCESS / FAILED).
   * - Kiểm tra chống trùng lặp (Idempotency).
   * - Cập nhật Payment.status = 'SUCCESS', Order.status = 'PAID' và cộng điểm thưởng Loyalty.
   */
  async handlePaymentWebhook(dto: PaymentWebhookDto) {
    // 1. Tìm giao dịch thanh toán
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
                toppings: { include: { topping: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán với ID "${dto.paymentId}"`);
    }

    // 2. Chống trùng lặp Webhook (Idempotency): Nếu giao dịch đã kết thúc, trả về kết quả trước đó
    if (payment.status === 'SUCCESS') {
      return {
        message: 'Giao dịch đã được xác nhận thành công trước đó (Idempotent Webhook)',
        success: true,
        isIdempotent: true,
        transactionRef: dto.transactionRef,
        payment,
        order: payment.order,
      };
    }

    if (payment.status === 'FAILED') {
      return {
        message: 'Giao dịch đã được ghi nhận thất bại trước đó (Idempotent Webhook)',
        success: false,
        isIdempotent: true,
        transactionRef: dto.transactionRef,
        payment,
        order: payment.order,
      };
    }

    // 3. Kiểm tra trạng thái đơn hàng
    if (payment.order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã bị hủy, không thể tiếp nhận webhook thanh toán');
    }

    if (payment.order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã hoàn tất trước đó');
    }

    const isSuccess = dto.outcome === 'SUCCESS';
    const nextPaymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextOrderStatus: OrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    // Xác thực chuyển trạng thái đơn hàng qua Order State Machine
    OrderStateMachine.validateTransition(
      payment.order.status as OrderStatus,
      nextOrderStatus,
    );

    // 4. Dùng Transaction để cập nhật Payment, Order và cộng Loyalty Points
    const result = await this.prisma.$transaction(async (tx) => {
      // Kiểm tra lại trạng thái trong transaction chống race condition webhook gọi kép
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      if (currentPayment && currentPayment.status !== 'PENDING') {
        return {
          alreadyProcessed: true,
          payment: currentPayment,
          order: payment.order,
        };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: nextPaymentStatus },
      });

      const updatedOrder = await tx.order.update({
        where: { id: payment.orderId },
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
        payment.order.userId &&
        payment.order.pointsEarned &&
        payment.order.pointsEarned > 0
      ) {
        await tx.user.update({
          where: { id: payment.order.userId },
          data: {
            loyaltyPoints: { increment: payment.order.pointsEarned },
          },
        });
      }

      return {
        alreadyProcessed: false,
        payment: updatedPayment,
        order: updatedOrder,
      };
    });

    if (result.alreadyProcessed) {
      return {
        message: 'Giao dịch đã được xử lý đồng thời trước đó (Idempotent Webhook)',
        success: result.payment.status === 'SUCCESS',
        isIdempotent: true,
        transactionRef: dto.transactionRef,
        payment: result.payment,
        order: result.order,
      };
    }

    return {
      message: isSuccess
        ? 'Xác nhận thanh toán thành công từ Webhook! Đơn hàng đã chuyển sang trạng thái PAID.'
        : 'Cổng thanh toán báo giao dịch thất bại từ Webhook! Đơn hàng chuyển sang trạng thái PAYMENT_FAILED.',
      success: isSuccess,
      isIdempotent: false,
      transactionRef: dto.transactionRef,
      payment: result.payment,
      order: result.order,
    };
  }
}
