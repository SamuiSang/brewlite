import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class RecipeItemDto {
  @IsString()
  @IsNotEmpty({ message: 'ingredientId không được để trống' })
  ingredientId: string;

  @IsString()
  @IsOptional()
  @IsIn(['S', 'M', 'L'])
  size?: 'S' | 'M' | 'L';

  @IsNumber()
  @Min(0.001, { message: 'Định lượng phải lớn hơn 0' })
  amount: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Tỷ lệ hao hụt không được âm' })
  @Max(100, { message: 'Tỷ lệ hao hụt tối đa 100%' })
  wasteRate?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SetProductRecipeDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Công thức phải có ít nhất 1 dòng nguyên liệu' })
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  recipes: RecipeItemDto[];
}
