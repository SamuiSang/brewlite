import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateStockReceiptDto } from './dto/create-receipt.dto';
import { SetProductRecipeDto } from './dto/set-recipe.dto';
import { ValidateCartDto } from './dto/validate-cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Danh sách nguyên liệu và trạng thái tồn kho
   * GET /inventory/ingredients
   */
  @Get('ingredients')
  findAllIngredients() {
    return this.inventoryService.findAllIngredients();
  }

  /**
   * Kiểm tra giỏ hàng với tồn kho thực tế của nguyên liệu (BOM)
   * Không yêu cầu đăng nhập để khách vãng lai cũng có thể kiểm tra giỏ hàng
   * POST /inventory/validate-cart
   */
  @Post('validate-cart')
  validateCart(@Body() dto: ValidateCartDto) {
    return this.inventoryService.validateCart(dto);
  }

  /**
   * Thêm nguyên liệu mới vào kho
   * POST /inventory/ingredients
   */
  @UseGuards(JwtAuthGuard)
  @Post('ingredients')
  createIngredient(@Body() dto: CreateIngredientDto) {
    return this.inventoryService.createIngredient(dto);
  }

  /**
   * Cập nhật thông tin nguyên liệu
   * PATCH /inventory/ingredients/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch('ingredients/:id')
  updateIngredient(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      unit?: string;
      minimumStock?: number;
      costPerUnit?: number;
    },
  ) {
    return this.inventoryService.updateIngredient(id, dto);
  }

  /**
   * Điều chỉnh tồn kho thủ công (kiểm kê, hao hụt)
   * PATCH /inventory/ingredients/:id/adjust
   */
  @UseGuards(JwtAuthGuard)
  @Patch('ingredients/:id/adjust')
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.inventoryService.adjustStock(id, dto, userId);
  }

  /**
   * Nhập kho nguyên liệu (hỗ trợ quy đổi đơn vị: kg -> g, lít -> ml)
   * POST /inventory/receipts
   */
  @UseGuards(JwtAuthGuard)
  @Post('receipts')
  createStockReceipt(
    @Body() dto: CreateStockReceiptDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.inventoryService.createStockReceipt(dto, userId);
  }

  /**
   * Lịch sử giao dịch kho (Audit log)
   * GET /inventory/transactions?ingredientId=...&type=...&limit=50
   */
  @Get('transactions')
  getTransactions(
    @Query('ingredientId') ingredientId?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getTransactions({
      ingredientId,
      type,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * Danh sách tổng quan công thức của tất cả sản phẩm kèm giá vốn COGS
   * GET /inventory/recipes
   */
  @Get('recipes')
  getAllRecipesOverview() {
    return this.inventoryService.getAllRecipesOverview();
  }

  /**
   * Lấy công thức chi tiết của sản phẩm (BOM), tính toán COGS và khả năng pha chế
   * GET /inventory/recipes/:productId
   */
  @Get('recipes/:productId')
  getProductRecipe(@Param('productId') productId: string) {
    return this.inventoryService.getProductRecipe(productId);
  }

  /**
   * Cài đặt hoặc cập nhật công thức sản phẩm (BOM) & Tính giá vốn COGS
   * POST /inventory/recipes
   */
  @UseGuards(JwtAuthGuard)
  @Post('recipes')
  setProductRecipe(@Body() dto: SetProductRecipeDto) {
    return this.inventoryService.setProductRecipe(dto);
  }

  /**
   * Sao chép công thức từ sản phẩm khác (Copy Recipe)
   * POST /inventory/recipes/:productId/copy-from/:sourceProductId
   */
  @UseGuards(JwtAuthGuard)
  @Post('recipes/:productId/copy-from/:sourceProductId')
  copyProductRecipe(
    @Param('productId') productId: string,
    @Param('sourceProductId') sourceProductId: string,
  ) {
    return this.inventoryService.copyProductRecipe(productId, sourceProductId);
  }

  /**
   * Xóa một nguyên liệu ra khỏi công thức của sản phẩm
   * DELETE /inventory/recipes/:productId/ingredient/:ingredientId
   */
  @UseGuards(JwtAuthGuard)
  @Delete('recipes/:productId/ingredient/:ingredientId')
  deleteRecipeIngredient(
    @Param('productId') productId: string,
    @Param('ingredientId') ingredientId: string,
    @Query('size') size?: string,
  ) {
    return this.inventoryService.deleteRecipeIngredient(
      productId,
      ingredientId,
      size,
    );
  }

  /**
   * Tra cứu số ly tối đa có thể sản xuất dựa trên nguyên liệu thực tế (BOM)
   * GET /inventory/availability/:productId?size=M
   */
  @Get('availability/:productId')
  calculateProductAvailability(
    @Param('productId') productId: string,
    @Query('size') size?: 'S' | 'M' | 'L',
  ) {
    return this.inventoryService.calculateProductAvailability(
      productId,
      size || 'M',
    );
  }
}
