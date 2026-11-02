import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateReceiptItemDto {
  @IsString()
  @IsNotEmpty({ message: 'ingredientId không được để trống' })
  ingredientId: string;

  @IsNumber()
  @Min(0.001, { message: 'Số lượng nhập phải lớn hơn 0' })
  quantity: number;

  @IsString()
  @IsOptional()
  unit?: string; // Đơn vị khi nhập hàng (ví dụ 'kg', 'lít', 'hộp')

  @IsNumber()
  @Min(0, { message: 'Đơn giá không được âm' })
  unitCost: number; // Đơn giá theo đơn vị nhập
}

export class CreateStockReceiptDto {
  @IsString()
  @IsOptional()
  receiptCode?: string;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Phiếu nhập kho phải có ít nhất 1 dòng nguyên liệu' })
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items: CreateReceiptItemDto[];
}
