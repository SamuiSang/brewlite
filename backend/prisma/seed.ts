import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Bat dau khoi tao du lieu mau cho BrewLite...');

  // 1. Danh muc do uong (Categories)
  const categories = [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê Việt Nam',
      description: 'Cà phê Robusta truyền thống pha phin đậm đà',
      isActive: true,
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      name: 'Cà phê Máy',
      description: 'Cà phê pha máy từ hạt Arabica nguyên chất',
      isActive: true,
    },
    {
      id: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà Trái Cây',
      description: 'Trà ủ lạnh kết hợp trái cây nhiệt đới thanh mát',
      isActive: true,
    },
    {
      id: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà Sữa',
      description: 'Trà đậm vị kết hợp sữa tươi thanh trùng',
      isActive: true,
    },
    {
      id: 'c5555555-5555-5555-5555-555555555555',
      name: 'Đá Xay',
      description: 'Đồ uống đá xay mát lạnh phủ kem whipping béo mịn',
      isActive: true,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log(`[Seed] Da tao ${categories.length} danh muc do uong`);

  // 2. Topping
  const toppings = [
    {
      id: 't1111111-1111-1111-1111-111111111111',
      name: 'Trân châu đen',
      price: 10000,
      stock: 150,
    },
    {
      id: 't2222222-2222-2222-2222-222222222222',
      name: 'Trân châu trắng 3Q',
      price: 10000,
      stock: 150,
    },
    {
      id: 't3333333-3333-3333-3333-333333333333',
      name: 'Thạch cà phê',
      price: 10000,
      stock: 100,
    },
    {
      id: 't4444444-4444-4444-4444-444444444444',
      name: 'Thạch củ năng',
      price: 10000,
      stock: 100,
    },
    {
      id: 't5555555-5555-5555-5555-555555555555',
      name: 'Kem Macchiato phô mai',
      price: 12000,
      stock: 80,
    },
    {
      id: 't6666666-6666-6666-6666-666666666666',
      name: 'Đào ngâm miếng',
      price: 12000,
      stock: 80,
    },
    {
      id: 't7777777-7777-7777-7777-777777777777',
      name: 'Hạt sen tươi',
      price: 12000,
      stock: 60,
    },
    {
      id: 't8888888-8888-8888-8888-888888888888',
      name: 'Vải thiều ngâm',
      price: 12000,
      stock: 60,
    },
  ];

  for (const t of toppings) {
    await prisma.topping.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        price: t.price,
        stock: t.stock,
        isAvailable: true,
      },
      create: {
        id: t.id,
        name: t.name,
        price: t.price,
        stock: t.stock,
        isAvailable: true,
      },
    });
  }
  console.log(`[Seed] Da tao ${toppings.length} loai topping`);

  // 3. Danh sach Mon (Products)
  const products = [
    // Nhóm 1: Cà phê Việt Nam (cat-1)
    {
      id: 'p1111111-1111-1111-1111-111111111111',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê đen đá',
      description:
        'Cà phê phin truyền thống, vị đắng đậm nguyên bản từ hạt Robusta Đắk Lắk.',
      basePrice: 25000,
      imageUrl:
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p1111111-1111-1111-1111-222222222222',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê sữa đá',
      description:
        'Cà phê phin đậm đà hòa quyện cùng sữa đặc béo ngọt truyền thống.',
      basePrice: 29000,
      imageUrl:
        'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p1111111-1111-1111-1111-333333333333',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Bạc xỉu',
      description:
        'Nhiều sữa ít cà phê, vị ngọt béo dịu nhẹ phù hợp với người thích vị ngọt ngào.',
      basePrice: 32000,
      imageUrl:
        'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p1111111-1111-1111-1111-444444444444',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê muối',
      description:
        'Cà phê truyền thống kết hợp lớp kem mặn béo mịn màng đặc trưng.',
      basePrice: 35000,
      imageUrl:
        'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80',
    },

    // Nhóm 2: Cà phê Máy (cat-2)
    {
      id: 'p2222222-2222-2222-2222-111111111111',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Americano',
      description:
        'Espresso pha loãng với nước, vị thanh thoát và hậu vị êm dịu.',
      basePrice: 35000,
      imageUrl:
        'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2222222-2222-2222-2222-222222222222',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Latte',
      description:
        'Espresso kết hợp sữa tươi đánh nóng với lớp bọt sữa mỏng mềm mịn.',
      basePrice: 45000,
      imageUrl:
        'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2222222-2222-2222-2222-333333333333',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Cappuccino',
      description:
        'Tỉ lệ cân bằng giữa Espresso, sữa tươi và lớp bọt sữa dày rắc bột cacao.',
      basePrice: 45000,
      imageUrl:
        'https://images.unsplash.com/photo-1572442388796-11668ba67e53?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2222222-2222-2222-2222-444444444444',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Caramel Macchiato',
      description:
        'Sữa tươi hương vani kết hợp Espresso đậm đà và sốt caramel thơm lừng.',
      basePrice: 49000,
      imageUrl:
        'https://images.unsplash.com/photo-1485808191629-be0dc82f8141?w=600&auto=format&fit=crop&q=80',
    },

    // Nhóm 3: Trà Trái Cây (cat-3)
    {
      id: 'p3333333-3333-3333-3333-111111111111',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà đào cam sả',
      description:
        'Trà đen thơm nồng kết hợp hương cam tươi, sả đập dập và đào giòn ngọt.',
      basePrice: 42000,
      imageUrl:
        'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p3333333-3333-3333-3333-222222222222',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà vải lài',
      description:
        'Trà xanh hoa lài thanh mát hòa quyện cùng nước cốt vải ngọt thanh dịu nhẹ.',
      basePrice: 42000,
      imageUrl:
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p3333333-3333-3333-3333-333333333333',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà thanh đào',
      description:
        'Trà thanh đào thanh lọc cơ thể, giải nhiệt hiệu quả ngày oi bức.',
      basePrice: 39000,
      imageUrl:
        'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p3333333-3333-3333-3333-444444444444',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà dâu tằm tuyết',
      description:
        'Trà hoa lài ủ lạnh kết hợp dâu tằm tươi Đà Lạt, chua ngọt tự nhiên sảng khoái.',
      basePrice: 45000,
      imageUrl:
        'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    },

    // Nhóm 4: Trà Sữa (cat-4)
    {
      id: 'p4444444-4444-4444-4444-111111111111',
      categoryId: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà sữa Ô Long nướng',
      description:
        'Cốt trà Ô Long sao nướng đậm vị khói, kết hợp vị sữa béo ngậy ngọt dịu.',
      basePrice: 39000,
      imageUrl:
        'https://images.unsplash.com/photo-1558857563-b37cf5a9c9f2?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p4444444-4444-4444-4444-222222222222',
      categoryId: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà sữa lài',
      description:
        'Vị trà lài ngát hương quyện cùng sữa thơm béo, thanh tao nhẹ nhàng.',
      basePrice: 39000,
      imageUrl:
        'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&auto=format&fit=crop&q=80',
    },

    // Nhóm 5: Đá Xay (cat-5)
    {
      id: 'p5555555-5555-5555-5555-111111111111',
      categoryId: 'c5555555-5555-5555-5555-555555555555',
      name: 'Matcha Freeze',
      description:
        'Bột trà xanh Uji Nhật Bản xay cùng đá tuyết và sữa, phủ lớp kem whipping.',
      basePrice: 49000,
      imageUrl:
        'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p5555555-5555-5555-5555-222222222222',
      categoryId: 'c5555555-5555-5555-5555-555555555555',
      name: 'Caramel Freeze',
      description:
        'Cà phê nguyên chất xay nhuyễn cùng sốt caramel béo mịn, phủ kem whipping.',
      basePrice: 49000,
      imageUrl:
        'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        imageUrl: p.imageUrl,
        isActive: true,
      },
      create: {
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        imageUrl: p.imageUrl,
        isActive: true,
      },
    });
  }
  console.log(`[Seed] Da tao ${products.length} mon do uong`);

  // Định lượng mẫu cho size S; kho dùng gram, millilitre hoặc cái, không dùng kg/lít.
  const ingredients: [string, string, number][] = [
    ['Bột cà phê Robusta', 'g', 1000],
    ['Bột cà phê Arabica', 'g', 1000],
    ['Sữa đặc', 'g', 3000],
    ['Sữa tươi', 'ml', 10000],
    ['Đường', 'g', 3000],
    ['Kem whipping', 'ml', 2000],
    ['Muối', 'g', 100],
    ['Bột cacao', 'g', 500],
    ['Sốt caramel', 'ml', 2000],
    ['Syrup vani', 'ml', 1000],
    ['Trà đen', 'g', 1000],
    ['Trà lài', 'g', 1000],
    ['Trà Ô Long', 'g', 1000],
    ['Đào ngâm', 'g', 3000],
    ['Cam tươi', 'g', 3000],
    ['Sả', 'g', 1000],
    ['Vải ngâm', 'g', 3000],
    ['Dâu tằm', 'g', 3000],
    ['Bột matcha', 'g', 500],
    ['Nước lọc', 'ml', 50000],
    ['Đá viên', 'g', 30000],
    ['Ly size S', 'cái', 200],
    ['Ly size M', 'cái', 200],
    ['Ly size L', 'cái', 200],
  ];
  const recipes: Record<string, Record<string, number>> = {
    'Cà phê đen đá': {
      'Bột cà phê Robusta': 10,
      'Nước lọc': 70,
      Đường: 10,
      'Đá viên': 100,
    },
    'Cà phê sữa đá': {
      'Bột cà phê Robusta': 10,
      'Nước lọc': 70,
      'Sữa đặc': 25,
      'Đá viên': 100,
    },
    'Bạc xỉu': {
      'Bột cà phê Robusta': 5,
      'Nước lọc': 35,
      'Sữa đặc': 30,
      'Sữa tươi': 80,
      'Đá viên': 100,
    },
    'Cà phê muối': {
      'Bột cà phê Robusta': 10,
      'Nước lọc': 70,
      'Sữa đặc': 20,
      'Kem whipping': 25,
      Muối: 0.5,
      'Đá viên': 100,
    },
    Americano: { 'Bột cà phê Arabica': 18, 'Nước lọc': 180 },
    Latte: { 'Bột cà phê Arabica': 18, 'Nước lọc': 40, 'Sữa tươi': 150 },
    Cappuccino: {
      'Bột cà phê Arabica': 18,
      'Nước lọc': 40,
      'Sữa tươi': 120,
      'Bột cacao': 2,
    },
    'Caramel Macchiato': {
      'Bột cà phê Arabica': 18,
      'Nước lọc': 40,
      'Sữa tươi': 130,
      'Syrup vani': 10,
      'Sốt caramel': 15,
    },
    'Trà đào cam sả': {
      'Trà đen': 5,
      'Nước lọc': 150,
      'Đào ngâm': 40,
      'Cam tươi': 20,
      Sả: 5,
      Đường: 15,
      'Đá viên': 100,
    },
    'Trà vải lài': {
      'Trà lài': 5,
      'Nước lọc': 150,
      'Vải ngâm': 40,
      Đường: 15,
      'Đá viên': 100,
    },
    'Trà thanh đào': {
      'Trà đen': 5,
      'Nước lọc': 150,
      'Đào ngâm': 40,
      Đường: 15,
      'Đá viên': 100,
    },
    'Trà dâu tằm tuyết': {
      'Trà lài': 5,
      'Nước lọc': 150,
      'Dâu tằm': 40,
      Đường: 15,
      'Đá viên': 100,
    },
    'Trà sữa Ô Long nướng': {
      'Trà Ô Long': 5,
      'Nước lọc': 100,
      'Sữa tươi': 80,
      'Sữa đặc': 20,
      'Đá viên': 100,
    },
    'Trà sữa lài': {
      'Trà lài': 5,
      'Nước lọc': 100,
      'Sữa tươi': 80,
      'Sữa đặc': 20,
      'Đá viên': 100,
    },
    'Matcha Freeze': {
      'Bột matcha': 5,
      'Sữa tươi': 100,
      'Sữa đặc': 20,
      'Kem whipping': 25,
      'Đá viên': 150,
    },
    'Caramel Freeze': {
      'Bột cà phê Arabica': 18,
      'Nước lọc': 40,
      'Sữa tươi': 80,
      'Sốt caramel': 20,
      'Kem whipping': 25,
      'Đá viên': 150,
    },
  };
  const ingredientIds = new Map<string, string>();
  for (const [name, unit, stock] of ingredients) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name },
      update: { unit },
      create: { name, unit, stock },
    });
    ingredientIds.set(name, ingredient.id);
  }

  for (const product of products) {
    const recipe = recipes[product.name];
    if (!recipe || Object.keys(recipe).length === 0) {
      throw new Error(`Thiếu công thức mẫu cho ${product.name}`);
    }
    for (const [size, multiplier] of [
      ['S', 1],
      ['M', 1.25],
      ['L', 1.5],
    ] as const) {
      // Mỗi ly chỉ dùng một vỏ ly đúng size; nguyên liệu pha chế tăng theo hệ số.
      const portions: [string, number][] = [
        ...Object.entries(recipe).map(([name, amount]): [string, number] => [
          name,
          amount * multiplier,
        ]),
        [`Ly size ${size}`, 1],
      ];
      for (const [name, quantity] of portions) {
        const ingredientId = ingredientIds.get(name);
        if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(
            `Định lượng không hợp lệ: ${product.name} / ${size} / ${name}`,
          );
        }
        await prisma.recipeIngredient.upsert({
          where: {
            productId_size_ingredientId: {
              productId: product.id,
              size,
              ingredientId,
            },
          },
          update: { quantity },
          create: { productId: product.id, size, ingredientId, quantity },
        });
      }
    }
  }
  console.log(
    `[Seed] Da tao ${ingredients.length} nguyen lieu va cong thuc 3 size cho ${products.length} mon`,
  );

  // 4. Voucher khuyen mai
  const promotions = [
    {
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 40000,
      maxDiscountAmount: 20000,
      isActive: true,
    },
    {
      code: 'GIAM20K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderAmount: 60000,
      maxDiscountAmount: 20000,
      isActive: true,
    },
    {
      code: 'BREWLITE',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderAmount: 100000,
      maxDiscountAmount: 50000,
      isActive: true,
    },
  ];

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { code: promo.code },
      update: promo,
      create: promo,
    });
  }
  console.log(`[Seed] Da tao ${promotions.length} ma voucher khuyen mai`);

  // 5. Nguoi dung mau (Users)
  const users = [
    {
      id: 'u1111111-1111-1111-1111-111111111111',
      email: 'admin@brewlite.vn',
      passwordHash: '$2b$10$demo_hash_admin',
      fullName: 'Quan tri vien BrewLite',
      role: 'ADMIN',
      loyaltyPoints: 1000,
    },
    {
      id: 'u2222222-2222-2222-2222-222222222222',
      email: 'khachhang@gmail.com',
      passwordHash: '$2b$10$demo_hash_customer',
      fullName: 'Nguyen Van A',
      role: 'CUSTOMER',
      loyaltyPoints: 50,
    },
    {
      id: 'u3333333-3333-3333-3333-333333333333',
      email: 'barista@brewlite.vn',
      passwordHash: '$2b$10$demo_hash_barista',
      fullName: 'Nhan vien Pha che',
      role: 'BARISTA',
      loyaltyPoints: 100,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }
  console.log(`[Seed] Da tao ${users.length} tai khoan nguoi dung mau`);

  console.log('[Seed] Hoan tat nap du lieu mau thanh cong 100%.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
