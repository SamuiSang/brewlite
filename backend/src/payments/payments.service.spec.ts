import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

describe('PaymentsService (Task 8 BE & Task 10 Core - Idempotency & Webhook 2 bước)', () => {
  let service: PaymentsService;
  let prisma: any;

  const mockOrder = {
    id: 'ord-100',
    orderCode: '#1042',
    status: 'PENDING',
    totalAmount: new Prisma.Decimal(70000),
    pointsEarned: 7,
    userId: 'user-1',
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        findUnique: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      order: {
        findFirst: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      user: {
        update: jest.fn<any>(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('Chống trừ tiền 2 lần (Idempotency-Key) - 1 bước truyền thống', () => {
    it('thanh toán lần đầu thành công: tạo bản ghi Payment, cập nhật Order sang PAID và cộng điểm Loyalty', async () => {
      prisma.payment.findUnique.mockResolvedValue(null); // Chưa tồn tại key
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const mockCreatedPayment = {
        id: 'pay-1',
        orderId: 'ord-100',
        idempotencyKey: 'idem-key-123',
        status: 'SUCCESS',
        amount: new Prisma.Decimal(70000),
      };
      prisma.payment.create.mockResolvedValue(mockCreatedPayment);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-key-123',
      };

      const result = await service.processMockPayment(dto);

      expect(result.success).toBe(true);
      expect(result.isIdempotent).toBe(false);
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'ord-100',
          idempotencyKey: 'idem-key-123',
          status: 'SUCCESS',
        }),
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-100' },
        data: { status: 'PAID' },
        include: expect.any(Object),
      });
      // Cộng 7 điểm loyalty cho user-1
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { increment: 7 } },
      });
    });

    it('gửi lại request với CÙNG Idempotency-Key: trả về kết quả giao dịch trước đó, KHÔNG trừ tiền hay cộng điểm lần 2', async () => {
      const existingPayment = {
        id: 'pay-1',
        orderId: 'ord-100',
        idempotencyKey: 'idem-key-123',
        status: 'SUCCESS',
        amount: new Prisma.Decimal(70000),
      };

      // Giả lập key đã tồn tại trong CSDL
      prisma.payment.findUnique.mockResolvedValue(existingPayment);
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-key-123',
      };

      const result = await service.processMockPayment(dto);

      expect(result.isIdempotent).toBe(true);
      expect(result.payment).toEqual(existingPayment);
      // KHÔNG được gọi tạo payment hoặc cộng điểm lần nữa
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('xử lý an toàn khi xảy ra race condition (hai request đồng thời chạm lỗi P2002 Unique Constraint)', async () => {
      // Ban đầu findUnique chưa thấy (do 2 request đến cùng thời điểm)
      prisma.payment.findUnique.mockResolvedValueOnce(null);
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      // Request 2 bị chặn bởi Unique Constraint ở DB
      const p2002Error: any = new Error('Unique constraint failed on the fields: (idempotency_key)');
      p2002Error.code = 'P2002';
      prisma.payment.create.mockRejectedValue(p2002Error);

      const existingPayment = {
        id: 'pay-concurrent',
        orderId: 'ord-100',
        idempotencyKey: 'idem-race-key',
        status: 'SUCCESS',
        amount: new Prisma.Decimal(70000),
      };
      // Khi catch lỗi P2002, query lại thì thấy bản ghi đã được tạo bởi request 1
      prisma.payment.findUnique.mockResolvedValueOnce(existingPayment);
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-race-key',
      };

      const result = await service.processMockPayment(dto);

      expect(result.isIdempotent).toBe(true);
      expect(result.payment).toEqual(existingPayment);
    });

    it('từ chối thanh toán khi đơn hàng đã ở trạng thái PAID với key khác', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      const dto = {
        orderId: 'ord-100',
        method: 'MOMO',
        idempotencyKey: 'new-key-456',
      };

      await expect(service.processMockPayment(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processMockPayment(dto)).rejects.toThrow(
        /đã được thanh toán/,
      );
    });

    it('từ chối thanh toán khi đơn hàng đã bị CANCELLED', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const dto = {
        orderId: 'ord-100',
        method: 'MOMO',
      };

      await expect(service.processMockPayment(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processMockPayment(dto)).rejects.toThrow(
        /đã bị hủy/,
      );
    });

    it('khi thanh toán thất bại (mockSuccess = false): cập nhật Payment FAILED và Order PAYMENT_FAILED, không cộng điểm', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const mockFailedPayment = {
        id: 'pay-fail',
        orderId: 'ord-100',
        idempotencyKey: 'idem-fail-123',
        status: 'FAILED',
        amount: new Prisma.Decimal(70000),
      };
      prisma.payment.create.mockResolvedValue(mockFailedPayment);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAYMENT_FAILED',
      });

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-fail-123',
        mockSuccess: false,
      };

      const result = await service.processMockPayment(dto);

      expect(result.success).toBe(false);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PAYMENT_FAILED' },
        }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Thanh toán 2 bước & Webhook Callback (Task 8 & Task 10)', () => {
    it('Bước 1 (twoStep: true): tạo Payment PENDING, giữ nguyên Order = PENDING, trả về mã QR Sandbox', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const mockPendingPayment = {
        id: 'pay-twostep-1',
        orderId: 'ord-100',
        idempotencyKey: 'idem-twostep-1',
        method: 'VNPAY',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
      };
      prisma.payment.create.mockResolvedValue(mockPendingPayment);

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-twostep-1',
        twoStep: true,
      };

      const result = await service.processMockPayment(dto);

      expect(result.twoStep).toBe(true);
      expect(result.paymentId).toBe('pay-twostep-1');
      expect(result.qrPayload).toBeDefined();
      expect(result.qrCodeUrl).toBeDefined();
      expect(result.qrPayload).toContain('pay-twostep-1');
      // Tạo Payment với status = PENDING
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'ord-100',
          idempotencyKey: 'idem-twostep-1',
          status: 'PENDING',
        }),
      });
      // KHÔNG tự động cập nhật Order thành PAID (Order vẫn giữ nguyên PENDING)
      expect(prisma.order.update).not.toHaveBeenCalled();
      // KHÔNG cộng điểm loyalty ở bước 1
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('Bước 1 (twoStep: true): nếu gửi trùng idempotencyKey, trả về giao dịch cũ không tạo mới', async () => {
      const existingPendingPayment = {
        id: 'pay-twostep-1',
        orderId: 'ord-100',
        idempotencyKey: 'idem-twostep-1',
        method: 'VNPAY',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
      };
      prisma.payment.findUnique.mockResolvedValue(existingPendingPayment);
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const dto = {
        orderId: 'ord-100',
        method: 'VNPAY',
        idempotencyKey: 'idem-twostep-1',
        twoStep: true,
      };

      const result = await service.processMockPayment(dto);

      expect(result.isIdempotent).toBe(true);
      expect(result.paymentId).toBe('pay-twostep-1');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('Bước 2 (handlePaymentWebhook với outcome = SUCCESS): cập nhật Payment = SUCCESS, Order = PAID và cộng điểm Loyalty', async () => {
      const pendingPayment = {
        id: 'pay-twostep-1',
        orderId: 'ord-100',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
        order: {
          ...mockOrder,
          status: 'PENDING',
        },
      };

      prisma.payment.findUnique.mockResolvedValue(pendingPayment);
      prisma.payment.update.mockResolvedValue({
        ...pendingPayment,
        status: 'SUCCESS',
      });
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      const webhookDto = {
        paymentId: 'pay-twostep-1',
        outcome: 'SUCCESS' as const,
        transactionRef: 'SANDBOX_TXN_999',
      };

      const result = await service.handlePaymentWebhook(webhookDto);

      expect(result.success).toBe(true);
      expect(result.isIdempotent).toBe(false);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-twostep-1' },
        data: { status: 'SUCCESS' },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-100' },
        data: { status: 'PAID' },
        include: expect.any(Object),
      });
      // Cộng điểm thưởng Loyalty cho người dùng
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { increment: 7 } },
      });
    });

    it('Bước 2 (handlePaymentWebhook với outcome = FAILED): cập nhật Payment = FAILED, Order = PAYMENT_FAILED, không cộng điểm', async () => {
      const pendingPayment = {
        id: 'pay-twostep-1',
        orderId: 'ord-100',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
        order: {
          ...mockOrder,
          status: 'PENDING',
        },
      };

      prisma.payment.findUnique.mockResolvedValue(pendingPayment);
      prisma.payment.update.mockResolvedValue({
        ...pendingPayment,
        status: 'FAILED',
      });
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAYMENT_FAILED',
      });

      const webhookDto = {
        paymentId: 'pay-twostep-1',
        outcome: 'FAILED' as const,
        transactionRef: 'SANDBOX_TXN_FAIL',
      };

      const result = await service.handlePaymentWebhook(webhookDto);

      expect(result.success).toBe(false);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-twostep-1' },
        data: { status: 'FAILED' },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-100' },
        data: { status: 'PAYMENT_FAILED' },
        include: expect.any(Object),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('Bước 2 (Idempotency): nếu Webhook gửi lại cho Payment đã SUCCESS, trả về idempotent response và KHÔNG cộng điểm hay cập nhật lần 2', async () => {
      const alreadySuccessPayment = {
        id: 'pay-twostep-1',
        orderId: 'ord-100',
        status: 'SUCCESS',
        amount: new Prisma.Decimal(70000),
        order: {
          ...mockOrder,
          status: 'PAID',
        },
      };

      prisma.payment.findUnique.mockResolvedValue(alreadySuccessPayment);

      const webhookDto = {
        paymentId: 'pay-twostep-1',
        outcome: 'SUCCESS' as const,
        transactionRef: 'SANDBOX_TXN_999',
      };

      const result = await service.handlePaymentWebhook(webhookDto);

      expect(result.isIdempotent).toBe(true);
      expect(result.success).toBe(true);
      // KHÔNG gọi update Payment, Order hay User
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('Bước 2: ném NotFoundException khi paymentId không tồn tại', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      const webhookDto = {
        paymentId: 'pay-nonexistent',
        outcome: 'SUCCESS' as const,
      };

      await expect(service.handlePaymentWebhook(webhookDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Bước 2: ném BadRequestException nếu đơn hàng gắn liền đã bị CANCELLED', async () => {
      const cancelledPayment = {
        id: 'pay-twostep-cancelled',
        orderId: 'ord-100',
        status: 'PENDING',
        order: {
          ...mockOrder,
          status: 'CANCELLED',
        },
      };

      prisma.payment.findUnique.mockResolvedValue(cancelledPayment);

      const webhookDto = {
        paymentId: 'pay-twostep-cancelled',
        outcome: 'SUCCESS' as const,
      };

      await expect(service.handlePaymentWebhook(webhookDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.handlePaymentWebhook(webhookDto)).rejects.toThrow(
        /đã bị hủy/,
      );
    });
  });
});
