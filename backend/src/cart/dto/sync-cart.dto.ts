import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsString()
  @IsIn(['S', 'M', 'L'])
  size: 'S' | 'M' | 'L';

  @IsInt()
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
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

