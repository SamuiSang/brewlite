import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
} from './dto/voucher.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  /**
   * Lấy danh sách toàn bộ voucher
   * GET /vouchers?isActive=true&search=...
   */
  @Get()
  findAll(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const activeBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.vouchersService.findAll({ isActive: activeBool, search });
  }

  /**
   * Kiểm tra tính hợp lệ và số tiền giảm của voucher
   * POST /vouchers/validate
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('validate')
  validateVoucher(@Body() dto: ValidateVoucherDto, @Req() req: any) {
    const userId = dto.userId || req.user?.sub || req.user?.id;
    return this.vouchersService.validateVoucher({ ...dto, userId });
  }

  /**
   * Lấy chi tiết 1 voucher theo mã code
   * GET /vouchers/:code
   */
  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.vouchersService.findByCode(code);
  }

  /**
   * Tạo voucher khuyến mãi mới (Yêu cầu đăng nhập Admin/Barista)
   * POST /vouchers
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  /**
   * Cập nhật thông tin voucher (Method PATCH)
   * PATCH /vouchers/:code
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(code, dto);
  }

  /**
   * Cập nhật thông tin voucher (Method PUT)
   * PUT /vouchers/:code
   */
  @UseGuards(JwtAuthGuard)
  @Put(':code')
  updatePut(@Param('code') code: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(code, dto);
  }

  /**
   * Xóa hoặc vô hiệu hóa voucher
   * DELETE /vouchers/:code
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':code')
  delete(@Param('code') code: string) {
    return this.vouchersService.delete(code);
  }
}

/**
 * Controller bí danh (Alias) cho /promotions để hỗ trợ cả 2 endpoint tương đương
 */
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  findAll(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const activeBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.vouchersService.findAll({ isActive: activeBool, search });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('validate')
  validateVoucher(@Body() dto: ValidateVoucherDto, @Req() req: any) {
    const userId = dto.userId || req.user?.sub || req.user?.id;
    return this.vouchersService.validateVoucher({ ...dto, userId });
  }

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.vouchersService.findByCode(code);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(code, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':code')
  updatePut(@Param('code') code: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(code, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':code')
  delete(@Param('code') code: string) {
    return this.vouchersService.delete(code);
  }
}
