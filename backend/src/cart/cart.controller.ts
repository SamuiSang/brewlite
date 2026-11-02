import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { SyncCartDto } from './dto/sync-cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Lấy giỏ hàng của tài khoản đang đăng nhập
   * GET /cart
   */
  @Get()
  getCart(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.getCart(userId);
  }

  /**
   * Đồng bộ giỏ hàng của tài khoản đang đăng nhập
   * PUT /cart
   */
  @Put()
  syncCart(@Req() req: any, @Body() dto: SyncCartDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.syncCart(userId, dto);
  }

  /**
   * Xóa giỏ hàng của tài khoản đang đăng nhập
   * DELETE /cart
   */
  @Delete()
  clearCart(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.cartService.clearCart(userId);
  }
}

