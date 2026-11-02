import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  PaymentWebhookDto,
  CreateVnpayUrlDto,
} from './dto/create-payment.dto';
import type { Request, Response } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * API Xử lý thanh toán (hỗ trợ Idempotency-Key qua header hoặc body)
   * POST /payments
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  createPayment(
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-idempotency-key') xIdempotencyKeyHeader?: string,
  ) {
    const key = idempotencyKeyHeader || xIdempotencyKeyHeader;
    if (key) {
      dto.idempotencyKey = key;
    }
    return this.paymentsService.processMockPayment(dto);
  }

  /**
   * API Webhook Callback nhận kết quả từ Cổng thanh toán Sandbox (Bước 2)
   * POST /payments/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Body() dto: PaymentWebhookDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-idempotency-key') xIdempotencyKeyHeader?: string,
  ) {
    const key = idempotencyKeyHeader || xIdempotencyKeyHeader;
    if (key && !dto.idempotencyKey) {
      dto.idempotencyKey = key;
    }
    return this.paymentsService.handlePaymentWebhook(dto);
  }

  /**
   * API Tạo URL thanh toán VNPAY Sandbox chuyên biệt
   * POST /payments/vnpay/create-url
   */
  @Post('vnpay/create-url')
  @HttpCode(HttpStatus.OK)
  createVnpayUrl(@Body() dto: CreateVnpayUrlDto, @Req() req: Request) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    return this.paymentsService.createVnpayPaymentUrl(dto, ipAddr);
  }

  /**
   * API Tiếp nhận IPN Webhook trực tiếp từ Cổng thanh toán VNPAY (Server-to-Server)
   * GET /payments/vnpay/ipn
   */
  @Get('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  handleVnpayIpn(@Query() query: Record<string, any>) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  /**
   * API Nhận phản hồi khi khách thanh toán xong trên VNPAY Sandbox (vnp_ReturnUrl)
   * GET /payments/vnpay/return
   */
  @Get('vnpay/return')
  async handleVnpayReturn(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.handleVnpayReturn(query);

    // Nếu client yêu cầu JSON hoặc gọi API trực tiếp qua Postman
    if (query.format === 'json') {
      return res.status(HttpStatus.OK).json(result);
    }

    // Mặc định điều hướng về giao diện Frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (result.success) {
      return res.redirect(
        `${frontendUrl}/order-success?orderId=${result.orderId}&code=${result.code}`,
      );
    } else {
      return res.redirect(
        `${frontendUrl}/payment-failed?orderId=${result.orderId || ''}&code=${result.code || '99'}`,
      );
    }
  }

  /**
   * API Lấy thông tin cấu hình và thẻ test mẫu VNPAY Sandbox
   * GET /payments/vnpay/config
   */
  @Get('vnpay/config')
  getVnpayConfig() {
    return this.paymentsService.getVnpayConfig();
  }
}
