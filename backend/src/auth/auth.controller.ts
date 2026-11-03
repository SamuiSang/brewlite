import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * API Lấy thông tin tài khoản hiện tại của phiên đăng nhập (Profile & Loyalty points)
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.authService.getProfile(userId);
  }

  /**
   * API Cập nhật thông tin tài khoản cá nhân (Họ tên, SĐT)
   * PATCH /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.authService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-order')
  testProtectedOrderRoute(@Req() req: any) {
    return {
      message: 'Xác thực Guard thành công! Bạn được phép đặt đơn.',
      user: req.user,
    };
  }
}
