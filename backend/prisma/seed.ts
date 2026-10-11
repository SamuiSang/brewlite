import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu (Seed Data) cho BrewLite...');

  // 1. Tạo Danh mục (Categories)
  const coffeeCat = await prisma.category.upsert({
    where: { id: 'c1111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê',
      description: 'Cà phê pha phin truyền thống và pha máy đặc sản',
      isActive: true,
    },
  });

  const teaCat = await prisma.category.upsert({
    where: { id: 'c2222222-2222-2222-2222-222222222222' },
    update: {},
    create: {
      id: 'c2222222-2222-2222-2222-222222222222',
      name: 'Trà trái cây',
      description: 'Trà trái cây tươi thanh mát, giải nhiệt',
      isActive: true,
    },
  });

  const milkTeaCat = await prisma.category.upsert({
    where: { id: 'c3333333-3333-3333-3333-333333333333' },
    update: {},
    create: {
      id: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà sữa',
      description: 'Trà sữa đậm vị trà béo vị sữa thơm lừng',
      isActive: true,
    },
  });

  const freezeCat = await prisma.category.upsert({
    where: { id: 'c4444444-4444-4444-4444-444444444444' },
    update: {},
    create: {
      id: 'c4444444-4444-4444-4444-444444444444',
      name: 'Freeze / Đá xay',
      description: 'Đá xay mát lạnh phủ kem tươi ngọt ngào',
      isActive: true,
    },
  });

  console.log('✅ Đã tạo danh mục đồ uống');

  // 2. Tạo Topping
  const toppings = [
    { id: 't1111111-1111-1111-1111-111111111111', name: 'Trân châu đen đường đen', price: 10000, stock: 100 },
    { id: 't2222222-2222-2222-2222-222222222222', name: 'Thạch củ năng giòn ngọt', price: 10000, stock: 100 },
    { id: 't3333333-3333-3333-3333-333333333333', name: 'Kem Cheese (Macchiato)', price: 12000, stock: 100 },
    { id: 't4444444-4444-4444-4444-444444444444', name: 'Trân châu trắng 3Q', price: 10000, stock: 100 },
  ];

  for (const t of toppings) {
    await prisma.topping.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        name: t.name,
        price: t.price,
        stock: t.stock,
        isAvailable: true,
      },
    });
  }
  console.log('✅ Đã tạo danh sách Topping');

  // 3. Tạo Món / Đồ uống (Products)
  const products = [
    {
      id: 'p1111111-1111-1111-1111-111111111111',
      categoryId: coffeeCat.id,
      name: 'Cà phê muối xứ Huế',
      description: 'Vị đắng êm của cà phê hòa quyện cùng lớp kem muối béo ngậy đặc trưng.',
      basePrice: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p2222222-2222-2222-2222-222222222222',
      categoryId: coffeeCat.id,
      name: 'Bạc xỉu 3 tầng',
      description: 'Sữa đặc, sữa tươi và cà phê Robusta nguyên chất tạo nên 3 tầng hương vị.',
      basePrice: 32000,
      imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p3333333-3333-3333-3333-333333333333',
      categoryId: teaCat.id,
      name: 'Trà đào cam sả thanh nhiệt',
      description: 'Vị trà thanh dịu kết hợp miếng đào giòn ngọt và hương sả thơm lừng.',
      basePrice: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p4444444-4444-4444-4444-444444444444',
      categoryId: teaCat.id,
      name: 'Trà lài dâu tằm Macchiato',
      description: 'Trà hoa lài ướp hương dâu tằm tươi chua ngọt, phủ lớp kem cheese mặn béo.',
      basePrice: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p5555555-5555-5555-5555-555555555555',
      categoryId: milkTeaCat.id,
      name: 'Trà sữa Ô Long nướng trân châu',
      description: 'Lá trà Ô Long được sao nướng đậm vị, kết hợp sữa béo ngậy ngọt dịu.',
      basePrice: 39000,
      imageUrl: 'https://images.unsplash.com/photo-1558857563-b37cf5a9c9f2?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p6666666-6666-6666-6666-666666666666',
      categoryId: freezeCat.id,
      name: 'Matcha Freeze đá xay',
      description: 'Bột trà xanh Uji Nhật Bản nguyên chất xay nhuyễn cùng đá, phủ kem tươi.',
      basePrice: 49000,
      imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        imageUrl: p.imageUrl,
        stock: p.stock,
        version: 1,
        isActive: true,
      },
    });
  }
  console.log('✅ Đã tạo danh sách Đồ uống (Products)');

  // 4. Tạo Voucher khuyến mãi mẫu
  await prisma.promotion.upsert({
    where: { code: 'BREWLITE10' },
    update: {},
    create: {
      code: 'BREWLITE10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 50000,
      maxDiscountAmount: 30000,
      isActive: true,
    },
  });
  console.log('✅ Đã tạo Voucher khuyến mãi: BREWLITE10');

  // 5. Tạo Người dùng mẫu (Admin & Customer)
  await prisma.user.upsert({
    where: { email: 'admin@brewlite.vn' },
    update: {},
    create: {
      id: 'u1111111-1111-1111-1111-111111111111',
      email: 'admin@brewlite.vn',
      passwordHash: '$2b$10$demo_hash_admin',
      fullName: 'Quản trị viên BrewLite',
      role: 'ADMIN',
      loyaltyPoints: 1000,
    },
  });

  await prisma.user.upsert({
    where: { email: 'khachhang@gmail.com' },
    update: {},
    create: {
      id: 'u2222222-2222-2222-2222-222222222222',
      email: 'khachhang@gmail.com',
      passwordHash: '$2b$10$demo_hash_customer',
      fullName: 'Nguyễn Văn Khách',
      role: 'CUSTOMER',
      loyaltyPoints: 50,
    },
  });
  console.log('✅ Đã tạo tài khoản mẫu');

  console.log('🎉 Seed dữ liệu mẫu hoàn tất 100%!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
