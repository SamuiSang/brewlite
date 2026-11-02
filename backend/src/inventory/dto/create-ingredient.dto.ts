import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên nguyên liệu không được để trống' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính không được để trống (ví dụ: g, ml, piece)' })
  unit: string;

  @IsNumber()
  @Min(0, { message: 'Tồn kho ban đầu không được âm' })
  @IsOptional()
  initialStock?: number;

  @IsNumber()
  @Min(0, { message: 'Định mức tồn kho tối thiểu không được âm' })
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @Min(0, { message: 'Giá vốn đơn vị không được âm' })
  @IsOptional()
  costPerUnit?: number;
}

