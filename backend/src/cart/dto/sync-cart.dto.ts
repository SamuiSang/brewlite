import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsString()
  @IsIn(['S', 'M', 'L'], { message: 'size phải là S, M hoặc L' })
  size: 'S' | 'M' | 'L';

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(9999, { message: 'Số lượng tối đa là 9999' })
  quantity: number;

  @IsOptional()
  @IsString()
  milk?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toppings?: string[];
}

export class SyncCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsOptional()
  @IsString()
  @IsIn(['S', 'M', 'L'], { message: 'size phải là S, M hoặc L' })
  size?: 'S' | 'M' | 'L';

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(9999, { message: 'Số lượng tối đa là 9999' })
  quantity?: number;

  @IsOptional()
  @IsString()
  milk?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toppings?: string[];
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsString()
  @IsIn(['S', 'M', 'L'], { message: 'size phải là S, M hoặc L' })
  size?: 'S' | 'M' | 'L';

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(9999, { message: 'Số lượng tối đa là 9999' })
  quantity?: number;

  @IsOptional()
  @IsString()
  milk?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toppings?: string[];
}

export class UpdateCartItemQuantityDto {
  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(0, { message: 'Số lượng không được âm' })
  @Max(9999, { message: 'Số lượng tối đa là 9999' })
  quantity?: number;

  @IsOptional()
  @IsInt({ message: 'delta phải là số nguyên' })
  delta?: number;
}

export class ApplyCartVoucherDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã voucher không được để trống' })
  code: string;
}

export class ToggleCartLoyaltyDto {
  @IsBoolean({ message: 'useLoyaltyPoints phải là boolean (true/false)' })
  useLoyaltyPoints: boolean;
}

export class CheckoutCartDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsInt({ message: 'Số điểm sử dụng phải là số nguyên' })
  @Min(0, { message: 'Số điểm sử dụng không được âm' })
  useLoyaltyPoints?: number;
}
