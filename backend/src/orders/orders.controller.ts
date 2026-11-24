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
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, ValidateVoucherDto } from './dto/create-order.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * API Kiểm tra mã voucher và tính toán giảm giá
   * POST /orders/validate-voucher
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('validate-voucher')
  validateVoucher(@Body() dto: ValidateVoucherDto, @Req() req: any) {
    return this.ordersService.validateVoucher(dto, req.user?.sub || req.user?.id);
  }

  /**
   * API Tạo đơn hàng mới kèm kiểm tra công thức nguyên liệu (BOM) & Optimistic Lock
   * Hỗ trợ Header Idempotency-Key để chống duplicate order khi client double-click hoặc retry
   * Bắt buộc xác thực người dùng (JwtAuthGuard)
   * Tuyệt đối không nhận userId từ body request để chống tấn công IDOR
   * POST /orders
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-idempotency-key') xIdempotencyKeyHeader?: string,
  ) {
    const authUserId = req.user?.sub || req.user?.id;
    // Cưỡng chế gắn userId từ token xác thực
    dto.userId = authUserId;
    const idempotencyKey = idempotencyKeyHeader || xIdempotencyKeyHeader;
    return this.ordersService.createOrder(dto, idempotencyKey);
  }

  /**
   * API Lấy danh sách lịch sử đơn hàng của người dùng đăng nhập
   * GET /orders/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMyOrders(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.ordersService.findMyOrders(userId);
  }

  /**
   * API Lấy danh sách đơn hàng
   * Nếu là CUSTOMER: CHỈ được xem đơn của chính mình (chặn rò rỉ dữ liệu / IDOR)
   * Nếu là ADMIN/BARISTA: Có thể tra cứu tất cả hoặc lọc theo userId
   * GET /orders
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('phone') phone?: string,
  ) {
    const userRole = req.user?.role;
    const currentUserId = req.user?.sub || req.user?.id;

    let targetUserId: string | undefined = undefined;
    if (userRole === 'ADMIN' || userRole === 'BARISTA') {
      targetUserId = userId || undefined;
    } else {
      // CUSTOMER chỉ được xem đơn của chính mình
      targetUserId = currentUserId;
    }

    return this.ordersService.findAll({ status, userId: targetUserId, phone });
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
   * Có kiểm tra quyền truy cập (CUSTOMER chỉ được xem đơn của mình)
   * GET /orders/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const order = await this.ordersService.findOne(id);
    const userRole = req.user?.role;
    const currentUserId = req.user?.sub || req.user?.id;

    if (
      userRole !== 'ADMIN' &&
      userRole !== 'BARISTA' &&
      order.userId &&
      order.userId !== currentUserId
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập vào thông tin đơn hàng của người khác',
      );
    }

    return order;
  }

  /**
   * API Cập nhật trạng thái đơn hàng (PENDING, PAID, PREPARING, READY, COMPLETED, CANCELLED)
   * Kèm lý do và người cập nhật
   * PATCH /orders/:id/status
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    const changedBy = req?.user?.fullName || req?.user?.email || 'SYSTEM';
    return this.ordersService.updateStatus(id, status, reason, changedBy);
  }

  /**
   * API Hủy đơn hàng (POST /orders/:id/cancel)
   * Áp dụng quy tắc "Hủy đơn nếu chưa làm" (PENDING, PAYMENT_FAILED, PAID)
   * Chống IDOR: Khách hàng chỉ được hủy đơn của mình
   * Tự động hoàn kho nguyên liệu thô (BOM) & hoàn điểm thưởng
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const currentUserId = req.user?.sub || req.user?.id;
    const userRole = req.user?.role;
    return this.ordersService.cancelOrder(id, currentUserId, userRole, reason);
  }

  /**
   * API Hủy đơn hàng (PATCH /orders/:id/cancel)
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancelOrderPatch(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const currentUserId = req.user?.sub || req.user?.id;
    const userRole = req.user?.role;
    return this.ordersService.cancelOrder(id, currentUserId, userRole, reason);
  }
}
