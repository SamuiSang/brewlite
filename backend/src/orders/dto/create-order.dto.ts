import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsString()
  @IsIn(['S', 'M', 'L'], { message: 'size phải là S, M hoặc L' })
  size: 'S' | 'M' | 'L';

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  qty: number;

  @IsArray({ message: 'Danh sách topping phải là mảng' })
  @IsOptional()
  @IsString({ each: true, message: 'Mỗi toppingId phải là chuỗi ký tự' })
  toppingIds?: string[];
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên khách hàng không được để trống' })
  customerName: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  promotionCode?: string;

  @IsInt({ message: 'Số điểm tích lũy sử dụng phải là số nguyên' })
  @Min(0, { message: 'Số điểm sử dụng không được âm' })
  @IsOptional()
  useLoyaltyPoints?: number;

  @IsArray({ message: 'Danh sách món (items) phải là một mảng' })
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 món' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class ValidateVoucherDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống' })
  code: string;

  @Min(0, { message: 'Tổng tiền đơn hàng không được âm' })
  subtotal: number;
}

