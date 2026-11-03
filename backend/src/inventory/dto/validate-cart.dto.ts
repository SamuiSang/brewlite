import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemValidateDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  size?: 'S' | 'M' | 'L';

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toppingIds?: string[];
}

export class ValidateCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemValidateDto)
  items: CartItemValidateDto[];
}

