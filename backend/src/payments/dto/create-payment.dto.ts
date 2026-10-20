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
}