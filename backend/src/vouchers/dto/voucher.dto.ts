import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateVoucherDto {
  @IsString({ message: 'Mã voucher phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã voucher không được để trống' })
  code: string;

  @IsString()
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT'], {
    message: 'Loại giảm giá phải là PERCENTAGE hoặc FIXED_AMOUNT',
  })
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';

  @IsNumber({}, { message: 'Giá trị giảm giá phải là số' })
  @Min(1, { message: 'Giá trị giảm giá phải lớn hơn 0' })
  discountValue: number;

  @IsNumber({}, { message: 'Giá trị đơn tối thiểu phải là số' })
  @Min(0, { message: 'Giá trị đơn tối thiểu không được âm' })
  @IsOptional()
  minOrderAmount?: number;

  @IsNumber({}, { message: 'Số tiền giảm tối đa phải là số' })
  @Min(0, { message: 'Số tiền giảm tối đa không được âm' })
  @IsOptional()
  maxDiscountAmount?: number;

  @IsDateString(
    {},
    {
      message:
        'Hạn sử dụng phải theo định dạng ngày ISO 8601 (VD: 2026-12-31T23:59:59.000Z)',
    },
  )
  @IsOptional()
  validUntil?: string;

  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean (true/false)' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateVoucherDto {
  @IsString()
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT'], {
    message: 'Loại giảm giá phải là PERCENTAGE hoặc FIXED_AMOUNT',
  })
  @IsOptional()
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';

  @IsNumber({}, { message: 'Giá trị giảm giá phải là số' })
  @Min(1, { message: 'Giá trị giảm giá phải lớn hơn 0' })
  @IsOptional()
  discountValue?: number;

  @IsNumber({}, { message: 'Giá trị đơn tối thiểu phải là số' })
  @Min(0, { message: 'Giá trị đơn tối thiểu không được âm' })
  @IsOptional()
  minOrderAmount?: number;

  @IsNumber({}, { message: 'Số tiền giảm tối đa phải là số' })
  @Min(0, { message: 'Số tiền giảm tối đa không được âm' })
  @IsOptional()
  maxDiscountAmount?: number;

  @IsDateString({}, { message: 'Hạn sử dụng phải theo định dạng ngày ISO 8601' })
  @IsOptional()
  validUntil?: string;

  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean (true/false)' })
  @IsOptional()
  isActive?: boolean;
}

export class ValidateVoucherDto {
  @IsString({ message: 'Mã voucher phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã voucher không được để trống' })
  code: string;

  @IsNumber({}, { message: 'Tổng tiền đơn hàng (subtotal) phải là số' })
  @Min(0, { message: 'Tổng tiền đơn hàng không được âm' })
  subtotal: number;

  @IsString()
  @IsOptional()
  userId?: string;
}
