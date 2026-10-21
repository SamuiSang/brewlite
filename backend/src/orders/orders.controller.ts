import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, ValidateVoucherDto } from './dto/create-order.dto';

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
   * POST /orders
   */
  @Post()
  create(@Body() dto: CreateOrderDto) {
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
