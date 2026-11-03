import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { VnpayService } from './vnpay.service';
import { OrdersService } from '../orders/orders.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { jest } from '@jest/globals';
import * as crypto from 'crypto';

describe('PaymentsService (Task 8 BE & Task 10 Core - Idempotency & Webhook 2 bước & VNPAY)', () => {
  let service: PaymentsService;
  let vnpayService: VnpayService;
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
        findFirst: jest.fn<any>(),
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
        VnpayService,
        {
          provide: OrdersService,
          useValue: {
            deductOrderInventoryInTx: jest.fn<any>().mockResolvedValue({ alreadyDeducted: false }),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    vnpayService = module.get<VnpayService>(VnpayService);
  });

  describe('Chống trừ tiền 2 lần (Idempotency-Key) - 1 bước truyền thống', () => {
    it('thanh toán lần đầu thành công: tạo bản ghi Payment, cập nhật Order sang PAID và cộng điểm Loyalty', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
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
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('xử lý an toàn khi xảy ra race condition (hai request đồng thời chạm lỗi P2002 Unique Constraint)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(null);
      prisma.order.findFirst.mockResolvedValue(mockOrder);

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
      expect(result.vnpayUrl).toBeDefined();
      expect(result.vnpayUrl).toContain('sandbox.vnpayment.vn');
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'ord-100',
          idempotencyKey: 'idem-twostep-1',
          status: 'PENDING',
        }),
      });
      expect(prisma.order.update).not.toHaveBeenCalled();
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

  describe('Tích hợp Cổng thanh toán VNPAY Sandbox thật (IPN & Return URL)', () => {
    it('VnpayService sinh URL thanh toán kèm chữ ký số HMAC-SHA512 hợp lệ', () => {
      const url = vnpayService.buildPaymentUrl({
        orderId: 'pay-vnpay-1',
        orderCode: '#1042',
        amount: 70000,
        bankCode: 'NCB',
      });

      expect(url).toContain('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
      expect(url).toContain('vnp_TmnCode=8VXIB1MM');
      expect(url).toContain('vnp_Amount=7000000');
      expect(url).toContain('vnp_BankCode=NCB');
      expect(url).toContain('vnp_SecureHash=');
    });

    it('VnpayService xác thực chữ ký số đúng và từ chối chữ ký giả mạo', () => {
      const validQuery = {
        vnp_Amount: '7000000',
        vnp_Command: 'pay',
        vnp_CreateDate: '20261102093000',
        vnp_CurrCode: 'VND',
        vnp_IpAddr: '127.0.0.1',
        vnp_Locale: 'vn',
        vnp_OrderInfo: 'Thanh toan don hang #1042',
        vnp_OrderType: 'other',
        vnp_ReturnUrl: 'http://localhost:3001/payments/vnpay/return',
        vnp_TmnCode: '8VXIB1MM',
        vnp_TxnRef: 'pay-vnpay-1',
        vnp_Version: '2.1.0',
      };

      // Sinh hash chuẩn
      const sorted = vnpayService.sortObject(validQuery);
      const signData = Object.keys(sorted)
        .map((k) => `${k}=${sorted[k]}`)
        .join('&');
      const validHash = crypto
        .createHmac('sha512', 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      expect(
        vnpayService.verifyChecksum({
          ...validQuery,
          vnp_SecureHash: validHash,
        }),
      ).toBe(true);

      // Chữ ký bị sai 1 ký tự
      expect(
        vnpayService.verifyChecksum({
          ...validQuery,
          vnp_SecureHash: 'fake_hash_123',
        }),
      ).toBe(false);
    });

    it('handleVnpayIpn: xử lý callback server-to-server thành công trả về RspCode 00', async () => {
      const pendingPayment = {
        id: 'pay-vnpay-real',
        orderId: 'ord-100',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
        order: {
          ...mockOrder,
          status: 'PENDING',
        },
      };
      prisma.payment.findUnique.mockResolvedValue(pendingPayment);

      const ipnQuery = {
        vnp_Amount: '7000000',
        vnp_BankCode: 'NCB',
        vnp_CardType: 'ATM',
        vnp_OrderInfo: 'Thanh toan don hang #1042',
        vnp_PayDate: '20261102093500',
        vnp_ResponseCode: '00',
        vnp_TmnCode: '8VXIB1MM',
        vnp_TransactionNo: '14567890',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: 'pay-vnpay-real',
      };

      // Tạo chữ ký hợp lệ
      const sorted = vnpayService.sortObject(ipnQuery);
      const signData = Object.keys(sorted)
        .map((k) => `${k}=${sorted[k]}`)
        .join('&');
      const secureHash = crypto
        .createHmac('sha512', 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const result = await service.handleVnpayIpn({
        ...ipnQuery,
        vnp_SecureHash: secureHash,
      });

      expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-vnpay-real' },
        data: { status: 'SUCCESS' },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-100' },
        data: { status: 'PAID' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loyaltyPoints: { increment: 7 } },
      });
    });

    it('handleVnpayIpn: từ chối khi sai chữ ký bảo mật trả về RspCode 97', async () => {
      const result = await service.handleVnpayIpn({
        vnp_TxnRef: 'pay-123',
        vnp_SecureHash: 'invalid_hash',
      });

      expect(result).toEqual({ RspCode: '97', Message: 'Checksum failed' });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('handleVnpayIpn: phát hiện số tiền không khớp trả về RspCode 04', async () => {
      const pendingPayment = {
        id: 'pay-vnpay-real',
        orderId: 'ord-100',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000), // 70.000đ -> 7.000.000
        order: mockOrder,
      };
      prisma.payment.findUnique.mockResolvedValue(pendingPayment);

      const ipnQuery = {
        vnp_Amount: '9999999', // Số tiền giả mạo
        vnp_TxnRef: 'pay-vnpay-real',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      };

      const sorted = vnpayService.sortObject(ipnQuery);
      const signData = Object.keys(sorted)
        .map((k) => `${k}=${sorted[k]}`)
        .join('&');
      const secureHash = crypto
        .createHmac('sha512', 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const result = await service.handleVnpayIpn({
        ...ipnQuery,
        vnp_SecureHash: secureHash,
      });

      expect(result).toEqual({ RspCode: '04', Message: 'Invalid amount' });
    });

    it('handleVnpayIpn: bảo vệ Idempotency khi giao dịch đã xử lý trước đó trả về RspCode 02', async () => {
      const alreadyConfirmedPayment = {
        id: 'pay-vnpay-real',
        orderId: 'ord-100',
        status: 'SUCCESS', // Đã confirm
        amount: new Prisma.Decimal(70000),
        order: mockOrder,
      };
      prisma.payment.findUnique.mockResolvedValue(alreadyConfirmedPayment);

      const ipnQuery = {
        vnp_Amount: '7000000',
        vnp_TxnRef: 'pay-vnpay-real',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      };

      const sorted = vnpayService.sortObject(ipnQuery);
      const signData = Object.keys(sorted)
        .map((k) => `${k}=${sorted[k]}`)
        .join('&');
      const secureHash = crypto
        .createHmac('sha512', 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const result = await service.handleVnpayIpn({
        ...ipnQuery,
        vnp_SecureHash: secureHash,
      });

      expect(result).toEqual({ RspCode: '02', Message: 'Order already confirmed' });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('handleVnpayReturn: xử lý redirect thành công từ VNPAY', async () => {
      const pendingPayment = {
        id: 'pay-vnpay-return',
        orderId: 'ord-100',
        status: 'PENDING',
        amount: new Prisma.Decimal(70000),
        order: mockOrder,
      };
      prisma.payment.findUnique.mockResolvedValue(pendingPayment);

      const returnQuery = {
        vnp_Amount: '7000000',
        vnp_BankCode: 'NCB',
        vnp_OrderInfo: 'Thanh toan don hang #1042',
        vnp_PayDate: '20261102094000',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: '998877',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: 'pay-vnpay-return',
      };

      const sorted = vnpayService.sortObject(returnQuery);
      const signData = Object.keys(sorted)
        .map((k) => `${k}=${sorted[k]}`)
        .join('&');
      const secureHash = crypto
        .createHmac('sha512', 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF')
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const result = await service.handleVnpayReturn({
        ...returnQuery,
        vnp_SecureHash: secureHash,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(result.orderId).toBe('ord-100');
    });

    describe('QR Pay: sinh mã QR offline, VietQR Napas và tra cứu thông tin QR', () => {
      it('VnpayService.generateQrDataUrl sinh mã QR base64 offline data:image/png', async () => {
        const qrDataUrl = await vnpayService.generateQrDataUrl('https://example.com/test-qr');
        expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
      });

      it('VnpayService.generateVietQrUrl sinh URL chuẩn VietQR Napas ngân hàng NCB (970419)', () => {
        const vietQrUrl = vnpayService.generateVietQrUrl({
          amount: 85000,
          orderCode: '#1055',
        });
        expect(vietQrUrl).toContain('https://img.vietqr.io/image/970419-8VXIB1MM-compact2.jpg');
        expect(vietQrUrl).toContain('amount=85000');
        expect(vietQrUrl).toContain('Thanh%20toan%20%231055');
      });

      it('getPaymentQr: lấy đầy đủ dữ liệu QR khi tìm thấy bằng paymentId', async () => {
        const paymentRecord = {
          id: 'pay-qr-test-1',
          orderId: 'ord-100',
          method: 'VNPAY',
          status: 'PENDING',
          amount: new Prisma.Decimal(70000),
          order: mockOrder,
        };
        prisma.payment.findUnique.mockResolvedValue(paymentRecord);

        const qrInfo = await service.getPaymentQr('pay-qr-test-1');

        expect(qrInfo.paymentId).toBe('pay-qr-test-1');
        expect(qrInfo.orderCode).toBe('#1042');
        expect(qrInfo.amount).toBe(70000);
        expect(qrInfo.vnpayUrl).toBeDefined();
        expect(qrInfo.qrCodeUrl).toBeDefined();
        expect(qrInfo.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(qrInfo.vietQrUrl).toContain('970419');
        expect(qrInfo.config.tmnCode).toBe('8VXIB1MM');
      });

      it('getPaymentQr: hỗ trợ fallback tìm kiếm theo orderId', async () => {
        prisma.payment.findUnique.mockResolvedValue(null);
        const paymentRecord = {
          id: 'pay-qr-test-2',
          orderId: 'ord-fallback-999',
          method: 'VNPAY',
          status: 'PENDING',
          amount: new Prisma.Decimal(120000),
          order: mockOrder,
        };
        prisma.payment.findFirst.mockResolvedValue(paymentRecord);

        const qrInfo = await service.getPaymentQr('ord-fallback-999');

        expect(prisma.payment.findFirst).toHaveBeenCalledWith({
          where: { orderId: 'ord-fallback-999' },
          include: { order: true },
          orderBy: { createdAt: 'desc' },
        });
        expect(qrInfo.paymentId).toBe('pay-qr-test-2');
        expect(qrInfo.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      });

      it('getPaymentQr: quăng NotFoundException khi không tìm thấy cả paymentId lẫn orderId', async () => {
        prisma.payment.findUnique.mockResolvedValue(null);
        prisma.payment.findFirst.mockResolvedValue(null);

        await expect(service.getPaymentQr('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
