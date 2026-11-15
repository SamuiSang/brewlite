import { Module } from '@nestjs/common';
import {
  VouchersController,
  PromotionsController,
} from './vouchers.controller';
import { VouchersService } from './vouchers.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VouchersController, PromotionsController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
