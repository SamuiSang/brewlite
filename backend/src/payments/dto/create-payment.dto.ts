import { IsString, IsNotEmpty, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'orderId không được để trống' })
  orderId: string;

  @IsString()
  @IsIn(['VNPAY', 'MOMO', 'BANK_TRANSFER', 'CARD', 'EWALLET'], {
    message: 'Phương thức thanh toán không hợp lệ',
  })
  method: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  // Cờ giả lập kết quả thanh toán (true = thành công, false = lỗi)
  @IsBoolean()
  @IsOptional()
  mockSuccess?: boolean;

  // Cờ thanh toán 2 bước (Khởi tạo PENDING + trả về QR -> Webhook callback xác nhận)
  @IsBoolean()
  @IsOptional()
  twoStep?: boolean;

  // Mã ngân hàng tùy chọn cho VNPAY (ví dụ: NCB, VNPAYQR, VISA)
  @IsString()
  @IsOptional()
  bankCode?: string;
}

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty({ message: 'paymentId không được để trống' })
  paymentId: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsIn(['SUCCESS', 'FAILED'], {
    message: 'outcome phải là SUCCESS hoặc FAILED',
  })
  outcome: 'SUCCESS' | 'FAILED';

  @IsString()
  @IsOptional()
  transactionRef?: string;
}

export class CreateVnpayUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'orderId không được để trống' })
  orderId: string;

  @IsString()
  @IsOptional()
  bankCode?: string;

  @IsString()
  @IsOptional()
  language?: 'vn' | 'en';

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
