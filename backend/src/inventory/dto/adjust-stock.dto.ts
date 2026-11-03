import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsNumber()
  @IsNotEmpty({ message: 'Số lượng điều chỉnh không được để trống' })
  quantityChange: number; // Có thể âm (giảm) hoặc dương (tăng)

  @IsString()
  @IsNotEmpty({ message: 'Lý do điều chỉnh không được để trống' })
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

