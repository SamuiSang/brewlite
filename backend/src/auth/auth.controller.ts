import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

  // --- ROUTE MẪU BẢO VỆ BẰNG GUARD ---
  // Sau này bên OrdersController chỉ cần thêm @UseGuards(JwtAuthGuard) y hệt như thế này
  @UseGuards(JwtAuthGuard)
  @Post('test-order')
  testProtectedOrderRoute(@Req() req: any) {
    return {
      message: 'Xác thực Guard thành công! Bạn được phép đặt đơn.',
      user: req.user, // Thông tin lấy ra từ bên trong token JWT
    };
  }
}