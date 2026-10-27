import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, ValidateVoucherDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * API Kiểm tra mã voucher và tính toán giảm giá
   * POST /orders/validate-voucher
   */
  @Post('validate-voucher')
  validateVoucher(@Body() dto: ValidateVoucherDto) {
    return this.ordersService.validateVoucher(dto);
  }

  /**
   * API Tạo đơn hàng mới (kèm Khóa tồn kho Optimistic Lock & Voucher/Loyalty)
   * Bắt buộc người dùng phải đăng nhập tài khoản (JwtAuthGuard)
   * POST /orders
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    if (req?.user?.sub && !dto.userId) {
      dto.userId = req.user.sub;
    }
    return this.ordersService.createOrder(dto);
  }

  /**
   * API Lấy danh sách tất cả các đơn hàng
   * GET /orders
   * Hỗ trợ query: ?status=PENDING&userId=...&phone=...
   */
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('phone') phone?: string,
  ) {
    return this.ordersService.findAll({ status, userId, phone });
  }

  /**
   * API Tra cứu đơn hàng theo mã đơn (ví dụ: #1042 hoặc 1042)
   * GET /orders/code/:orderCode
   */
  @Get('code/:orderCode')
  findByOrderCode(@Param('orderCode') orderCode: string) {
    return this.ordersService.findByOrderCode(orderCode);
  }

  /**
   * API Lấy các trạng thái kế tiếp hợp lệ theo Order State Machine
   * GET /orders/:id/allowed-transitions
   */
  @Get(':id/allowed-transitions')
  getAllowedNextStatuses(@Param('id') id: string) {
    return this.ordersService.getAllowedNextStatuses(id);
  }

  /**
   * API Lấy chi tiết đơn hàng theo ID (UUID)
   * GET /orders/:id
   */
  /**
   * API Lấy danh sách lịch sử đơn hàng của người dùng đăng nhập (Task 9 - Sprint 3)
   * GET /orders/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMyOrders(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.ordersService.findMyOrders(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  /**
   * API Cập nhật trạng thái đơn hàng (PENDING, PAID, PREPARING, READY, COMPLETED, CANCELLED)
   * PATCH /orders/:id/status
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ordersService.updateStatus(id, status);
  }
}
