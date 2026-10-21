import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

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
}