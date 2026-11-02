import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentDto,
  PaymentWebhookDto,
  CreateVnpayUrlDto,
} from './dto/create-payment.dto';
import { randomUUID } from 'crypto';
import { OrderStateMachine, OrderStatus } from '../orders/order-state-machine';
import { VnpayService } from './vnpay.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnpayService: VnpayService,
  ) {}

  /**
   * Xử lý thanh toán đơn hàng:
   * - Bước 1 (twoStep: true): Tạo bản ghi Payment ở trạng thái PENDING, giữ nguyên Order = PENDING,
   *   trả về mã giao dịch, mã QR Pay (offline base64 + VietQR) và VNPAY URL để khách quét mã hoặc thanh toán.
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

      let existingVnpayUrl: string | undefined;
      if (existingPayment.method === 'VNPAY' && order) {
        existingVnpayUrl = this.vnpayService.buildPaymentUrl({
          orderId: existingPayment.id,
          orderCode: order.orderCode,
          amount: Number(existingPayment.amount),
        });
      }

      const qrPayload =
        existingVnpayUrl ||
        `brewlite://sandbox-pay?paymentId=${existingPayment.id}&amount=${existingPayment.amount.toString()}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;
      const qrDataUrl = await this.vnpayService.generateQrDataUrl(qrPayload);
      const vietQrUrl = this.vnpayService.generateVietQrUrl({
        amount: Number(existingPayment.amount),
        orderCode: order?.orderCode || 'BrewLite',
      });

      return {
        message: 'Giao dịch đã được xử lý trước đó (Idempotent response)',
        success: existingPayment.status === 'SUCCESS',
        isIdempotent: true,
        twoStep: dto.twoStep ?? (existingPayment.status === 'PENDING'),
        paymentId: existingPayment.id,
        transactionRef: `SANDBOX_${existingPayment.id.slice(0, 8).toUpperCase()}`,
        vnpayUrl: existingVnpayUrl,
        qrPayload,
        qrCodeUrl,
        qrDataUrl,
        vietQrUrl,
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

    // 3. Xử lý Thanh toán 2 bước (Bước 1: Khởi tạo Payment PENDING + sinh mã QR Sandbox / VNPAY URL)
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

        // Nếu phương thức là VNPAY, sinh URL VNPAY Sandbox thật
        let vnpayUrl: string | undefined;
        if (dto.method === 'VNPAY') {
          vnpayUrl = this.vnpayService.buildPaymentUrl({
            orderId: payment.id,
            orderCode: order.orderCode,
            amount: Number(order.totalAmount),
            bankCode: dto.bankCode,
          });
        }

        const qrPayload =
          vnpayUrl ||
          `brewlite://sandbox-pay?paymentId=${payment.id}&orderCode=${encodeURIComponent(order.orderCode)}&amount=${order.totalAmount.toString()}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;
        const qrDataUrl = await this.vnpayService.generateQrDataUrl(qrPayload);
        const vietQrUrl = this.vnpayService.generateVietQrUrl({
          amount: Number(order.totalAmount),
          orderCode: order.orderCode,
        });

        return {
          message:
            dto.method === 'VNPAY'
              ? 'Khởi tạo giao dịch VNPAY Sandbox thành công (Truy cập vnpayUrl hoặc quét mã QR Pay để thanh toán).'
              : 'Khởi tạo giao dịch thanh toán thành công (Bước 1: Chờ quét mã QR Pay / Webhook callback từ cổng Sandbox).',
          success: true,
          twoStep: true,
          isIdempotent: false,
          paymentId: payment.id,
          orderId: order.id,
          orderCode: order.orderCode,
          amount: Number(order.totalAmount),
          transactionRef,
          vnpayUrl,
          qrPayload,
          qrCodeUrl,
          qrDataUrl,
          vietQrUrl,
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

            let existingVnpayUrl: string | undefined;
            if (existing.method === 'VNPAY' && freshOrder) {
              existingVnpayUrl = this.vnpayService.buildPaymentUrl({
                orderId: existing.id,
                orderCode: freshOrder.orderCode,
                amount: Number(existing.amount),
              });
            }

            const qrPayload =
              existingVnpayUrl ||
              `brewlite://sandbox-pay?paymentId=${existing.id}&amount=${existing.amount.toString()}`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;
            const qrDataUrl = await this.vnpayService.generateQrDataUrl(qrPayload);
            const vietQrUrl = this.vnpayService.generateVietQrUrl({
              amount: Number(existing.amount),
              orderCode: freshOrder?.orderCode || 'BrewLite',
            });

            return {
              message: 'Giao dịch đã được xử lý đồng thời trước đó (Idempotent response)',
              success: existing.status === 'SUCCESS' || existing.status === 'PENDING',
              isIdempotent: true,
              twoStep: true,
              paymentId: existing.id,
              transactionRef: `SANDBOX_${existing.id.slice(0, 8).toUpperCase()}`,
              vnpayUrl: existingVnpayUrl,
              qrPayload,
              qrCodeUrl,
              qrDataUrl,
              vietQrUrl,
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
   * Tạo URL thanh toán VNPAY Sandbox chuyên biệt
   */
  async createVnpayPaymentUrl(dto: CreateVnpayUrlDto, ipAddr?: string) {
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
      throw new BadRequestException('Đơn hàng này đã được thanh toán thành công trước đó');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng này đã bị hủy, không thể tiến hành thanh toán');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng này đã hoàn tất, không thể thanh toán lại');
    }

    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();

    // Tạo bản ghi Payment ở trạng thái PENDING
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        idempotencyKey,
        method: 'VNPAY',
        status: 'PENDING',
        amount: order.totalAmount,
      },
    });

    const vnpayUrl = this.vnpayService.buildPaymentUrl({
      orderId: payment.id,
      orderCode: order.orderCode,
      amount: Number(order.totalAmount),
      bankCode: dto.bankCode,
      language: dto.language,
      ipAddr,
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(vnpayUrl)}`;
    const qrDataUrl = await this.vnpayService.generateQrDataUrl(vnpayUrl);
    const vietQrUrl = this.vnpayService.generateVietQrUrl({
      amount: Number(order.totalAmount),
      orderCode: order.orderCode,
    });

    return {
      message: 'Tạo URL thanh toán VNPAY Sandbox thành công.',
      paymentId: payment.id,
      orderId: order.id,
      orderCode: order.orderCode,
      amount: Number(order.totalAmount),
      vnpayUrl,
      qrPayload: vnpayUrl,
      qrCodeUrl,
      qrDataUrl,
      vietQrUrl,
      config: this.vnpayService.getPublicConfig(),
    };
  }

  /**
   * Lấy chi tiết thông tin mã QR Pay (cả offline base64 và VietQR) cho giao dịch hoặc mã đơn hàng
   */
  async getPaymentQr(paymentId: string) {
    let payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    // Hỗ trợ tra cứu bằng orderId nếu không tìm thấy paymentId trực tiếp
    if (!payment) {
      payment = await this.prisma.payment.findFirst({
        where: { orderId: paymentId },
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán hoặc đơn hàng "${paymentId}"`);
    }

    let vnpayUrl: string | undefined;
    if (payment.method === 'VNPAY' && payment.order) {
      vnpayUrl = this.vnpayService.buildPaymentUrl({
        orderId: payment.id,
        orderCode: payment.order.orderCode,
        amount: Number(payment.amount),
      });
    }

    const qrPayload =
      vnpayUrl ||
      `brewlite://sandbox-pay?paymentId=${payment.id}&orderCode=${encodeURIComponent(payment.order?.orderCode || '')}&amount=${payment.amount.toString()}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;
    const qrDataUrl = await this.vnpayService.generateQrDataUrl(qrPayload);
    const vietQrUrl = this.vnpayService.generateVietQrUrl({
      amount: Number(payment.amount),
      orderCode: payment.order?.orderCode || 'BrewLite',
    });

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderCode: payment.order?.orderCode,
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
      vnpayUrl,
      qrPayload,
      qrCodeUrl,
      qrDataUrl,
      vietQrUrl,
      config: this.vnpayService.getPublicConfig(),
    };
  }

  /**
   * Xử lý IPN Webhook từ cổng thanh toán VNPAY (Server-to-Server Callback)
   * Trả về đúng định dạng chuẩn của VNPAY: { RspCode: '00', Message: 'Confirm Success' }
   */
  async handleVnpayIpn(query: Record<string, any>) {
    // 1. Kiểm tra chữ ký bảo mật HMAC-SHA512
    const isValidChecksum = this.vnpayService.verifyChecksum(query);
    if (!isValidChecksum) {
      return { RspCode: '97', Message: 'Checksum failed' };
    }

    // 2. Tìm giao dịch thanh toán qua vnp_TxnRef (đã gắn payment.id)
    const paymentId = String(query.vnp_TxnRef || '');
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 3. Kiểm tra số tiền giao dịch
    const vnpAmount = Number(query.vnp_Amount || 0);
    const expectedAmount = Math.round(Number(payment.amount) * 100);
    if (vnpAmount !== expectedAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    // 4. Kiểm tra trạng thái giao dịch (Idempotency check)
    if (payment.status !== 'PENDING') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    // 5. Cập nhật trạng thái giao dịch theo kết quả từ VNPAY
    const isSuccess =
      query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
    const nextPaymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextOrderStatus: OrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: nextPaymentStatus },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: nextOrderStatus },
      });

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
    });

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  /**
   * Xử lý khi khách hàng thanh toán xong và được VNPAY redirect về trình duyệt (vnp_ReturnUrl)
   */
  async handleVnpayReturn(query: Record<string, any>) {
    const isValidChecksum = this.vnpayService.verifyChecksum(query);
    if (!isValidChecksum) {
      return {
        success: false,
        message: 'Sai chữ ký bảo mật VNPAY (Checksum failed)',
        code: '97',
      };
    }

    const paymentId = String(query.vnp_TxnRef || '');
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      return {
        success: false,
        message: 'Không tìm thấy giao dịch thanh toán',
        code: '01',
      };
    }

    const isSuccess =
      query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';

    // Nếu IPN chưa chạy kịp và trạng thái vẫn PENDING, cập nhật luôn để khách không phải chờ
    if (payment.status === 'PENDING') {
      const nextPaymentStatus = isSuccess ? 'SUCCESS' : 'FAILED';
      const nextOrderStatus: OrderStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: nextPaymentStatus },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: nextOrderStatus },
        });

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
      });
    }

    return {
      success: isSuccess,
      message: isSuccess
        ? 'Thanh toán qua VNPAY Sandbox thành công!'
        : 'Giao dịch VNPAY không thành công hoặc người dùng đã hủy thanh toán.',
      code: String(query.vnp_ResponseCode || ''),
      orderId: payment.orderId,
      orderCode: payment.order.orderCode,
      amount: Number(payment.amount),
      transactionNo: String(query.vnp_TransactionNo || ''),
      bankCode: String(query.vnp_BankCode || ''),
      payDate: String(query.vnp_PayDate || ''),
    };
  }

  /**
   * Lấy cấu hình VNPAY Sandbox và thông tin thẻ test demo
   */
  getVnpayConfig() {
    return this.vnpayService.getPublicConfig();
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
