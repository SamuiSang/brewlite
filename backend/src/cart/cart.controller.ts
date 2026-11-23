import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  ApplyCartVoucherDto,
  CheckoutCartDto,
  SyncCartDto,
  ToggleCartLoyaltyDto,
  UpdateCartItemDto,
  UpdateCartItemQuantityDto,
} from './dto/sync-cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Lấy giỏ hàng đầy đủ của tài khoản đang đăng nhập
   * GET /cart
   */
  @Get()
  getCart(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.getCart(userId);
  }

  /**
   * Lấy tóm tắt tính tiền & kiểm tra BOM tồn kho của giỏ hàng
   * GET /cart/summary
   */
  @Get('summary')
  getCartSummary(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.getCartSummary(userId);
  }

  /**
   * Thêm 1 món vào giỏ hàng (tự gộp số lượng nếu trùng cấu hình)
   * POST /cart/items
   */
  @Post('items')
  addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.addItem(userId, dto);
  }

  /**
   * Lấy chi tiết 1 món trong giỏ hàng
   * GET /cart/items/:itemId
   */
  @Get('items/:itemId')
  getItem(@Req() req: any, @Param('itemId') itemId: string) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.getItem(userId, itemId);
  }

  /**
   * Cập nhật thông tin 1 món trong giỏ hàng (size, quantity, milk, note, toppings)
   * PATCH /cart/items/:itemId
   */
  @Patch('items/:itemId')
  updateItem(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.updateItem(userId, itemId, dto);
  }

  /**
   * Tăng/giảm hoặc đặt nhanh số lượng 1 món trong giỏ (xóa nếu <= 0)
   * PATCH /cart/items/:itemId/quantity
   */
  @Patch('items/:itemId/quantity')
  updateItemQuantity(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemQuantityDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.updateItemQuantity(userId, itemId, dto);
  }

  /**
   * Xóa 1 món cụ thể khỏi giỏ hàng
   * DELETE /cart/items/:itemId
   */
  @Delete('items/:itemId')
  removeItem(@Req() req: any, @Param('itemId') itemId: string) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.removeItem(userId, itemId);
  }

  /**
   * Đồng bộ (thay thế) toàn bộ giỏ hàng
   * PUT /cart
   */
  @Put()
  syncCart(@Req() req: any, @Body() dto: SyncCartDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.syncCart(userId, dto);
  }

  /**
   * Gộp giỏ hàng tạm (guest) vào giỏ hàng tài khoản
   * POST /cart/merge
   */
  @Post('merge')
  mergeCart(@Req() req: any, @Body() dto: SyncCartDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.mergeCart(userId, dto);
  }

  /**
   * Kiểm tra toàn bộ giỏ hàng hiện tại với tồn kho nguyên liệu (BOM)
   * POST /cart/validate
   */
  @Post('validate')
  validateCart(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.validateCart(userId);
  }

  /**
   * Áp dụng mã voucher vào giỏ hàng hiện tại
   * POST /cart/voucher
   */
  @Post('voucher')
  applyVoucher(@Req() req: any, @Body() dto: ApplyCartVoucherDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.applyVoucher(userId, dto.code);
  }

  /**
   * Gỡ mã voucher khỏi giỏ hàng hiện tại
   * DELETE /cart/voucher
   */
  @Delete('voucher')
  removeVoucher(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.removeVoucher(userId);
  }

  /**
   * Bật / tắt sử dụng điểm thưởng Loyalty cho giỏ hàng
   * PATCH /cart/loyalty
   */
  @Patch('loyalty')
  toggleLoyalty(@Req() req: any, @Body() dto: ToggleCartLoyaltyDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.toggleLoyalty(userId, dto.useLoyaltyPoints);
  }

  /**
   * Đặt hàng trực tiếp từ giỏ hàng trong DB và xóa giỏ hàng
   * POST /cart/checkout
   */
  @Post('checkout')
  checkout(@Req() req: any, @Body() dto: CheckoutCartDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.checkout(userId, dto);
  }

  /**
   * Xóa toàn bộ giỏ hàng của tài khoản đang đăng nhập
   * DELETE /cart
   */
  @Delete()
  clearCart(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.clearCart(userId);
  }
}
