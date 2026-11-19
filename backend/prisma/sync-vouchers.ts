import { PrismaClient } from '@prisma/client';

// Chỉ đồng bộ hai mã mới, không chạy lại seed sản phẩm hoặc tài khoản.
const prisma = new PrismaClient();
async function main() {
  for (const promotion of [
    { code: 'BREWLITE', discountType: 'PERCENTAGE', discountValue: 15, minOrderAmount: 100000, maxDiscountAmount: 50000, isActive: true },
    { code: 'BREW5', discountType: 'FIXED_AMOUNT', discountValue: 5000, minOrderAmount: 30000, maxDiscountAmount: 5000, isActive: true },
  ]) {
    await prisma.promotion.upsert({ where: { code: promotion.code }, update: promotion, create: promotion });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());