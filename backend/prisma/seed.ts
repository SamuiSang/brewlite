import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Bat dau khoi tao du lieu mau cho BrewLite (Phien ban nang cap toan dien)...');

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
    { id: 't1111111-1111-1111-1111-111111111111', name: 'Trân châu đen', price: 10000, stock: 150 },
    { id: 't2222222-2222-2222-2222-222222222222', name: 'Trân châu trắng 3Q', price: 10000, stock: 150 },
    { id: 't3333333-3333-3333-3333-333333333333', name: 'Thạch cà phê', price: 10000, stock: 100 },
    { id: 't4444444-4444-4444-4444-444444444444', name: 'Thạch củ năng', price: 10000, stock: 100 },
    { id: 't5555555-5555-5555-5555-555555555555', name: 'Kem Macchiato phô mai', price: 12000, stock: 80 },
    { id: 't6666666-6666-6666-6666-666666666666', name: 'Đào ngâm miếng', price: 12000, stock: 80 },
    { id: 't7777777-7777-7777-7777-777777777777', name: 'Hạt sen tươi', price: 12000, stock: 60 },
    { id: 't8888888-8888-8888-8888-888888888888', name: 'Vải thiều ngâm', price: 12000, stock: 60 },
  ];

  for (const t of toppings) {
    await prisma.topping.upsert({
      where: { id: t.id },
      update: { name: t.name, price: t.price, stock: t.stock, isAvailable: true },
      create: { id: t.id, name: t.name, price: t.price, stock: t.stock, isAvailable: true },
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
      description: 'Cà phê phin truyền thống, vị đắng đậm nguyên bản từ hạt Robusta Đắk Lắk.',
      basePrice: 25000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p1111111-1111-1111-1111-222222222222',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê sữa đá',
      description: 'Cà phê phin đậm đà hòa quyện cùng sữa đặc béo ngọt truyền thống.',
      basePrice: 29000,
      imageUrl: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p1111111-1111-1111-1111-333333333333',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Bạc xỉu',
      description: 'Nhiều sữa ít cà phê, vị ngọt béo dịu nhẹ phù hợp với người thích vị ngọt ngào.',
      basePrice: 32000,
      imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p1111111-1111-1111-1111-444444444444',
      categoryId: 'c1111111-1111-1111-1111-111111111111',
      name: 'Cà phê muối',
      description: 'Cà phê truyền thống kết hợp lớp kem mặn béo mịn màng đặc trưng.',
      basePrice: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },

    // Nhóm 2: Cà phê Máy (cat-2)
    {
      id: 'p2222222-2222-2222-2222-111111111111',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Americano',
      description: 'Espresso pha loãng với nước, vị thanh thoát và hậu vị êm dịu.',
      basePrice: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p2222222-2222-2222-2222-222222222222',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Latte',
      description: 'Espresso kết hợp sữa tươi đánh nóng với lớp bọt sữa mỏng mềm mịn.',
      basePrice: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p2222222-2222-2222-2222-333333333333',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Cappuccino',
      description: 'Tỉ lệ cân bằng giữa Espresso, sữa tươi và lớp bọt sữa dày rắc bột cacao.',
      basePrice: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p2222222-2222-2222-2222-444444444444',
      categoryId: 'c2222222-2222-2222-2222-222222222222',
      name: 'Caramel Macchiato',
      description: 'Sữa tươi hương vani kết hợp Espresso đậm đà và sốt caramel thơm lừng.',
      basePrice: 49000,
      imageUrl: 'https://images.unsplash.com/photo-1485808191629-be0dc82f8141?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },

    // Nhóm 3: Trà Trái Cây (cat-3)
    {
      id: 'p3333333-3333-3333-3333-111111111111',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà đào cam sả',
      description: 'Trà đen thơm mát kết hợp vị đào giòn ngọt, cam tươi và hương sả nồng ấm.',
      basePrice: 39000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p3333333-3333-3333-3333-222222222222',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà vải lài',
      description: 'Hương lài thanh tao hòa quyện vị ngọt thanh của vải thiều tươi mọng.',
      basePrice: 39000,
      imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p3333333-3333-3333-3333-333333333333',
      categoryId: 'c3333333-3333-3333-3333-333333333333',
      name: 'Trà ổi hồng hạt sen',
      description: 'Vị chua ngọt của ổi hồng kết hợp hạt sen bùi béo bổ dưỡng.',
      basePrice: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },

    // Nhóm 4: Trà Sữa (cat-4)
    {
      id: 'p4444444-4444-4444-4444-111111111111',
      categoryId: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà sữa truyền thống',
      description: 'Trà đen Ceylon đậm vị quyện cùng sữa tươi béo ngậy chuẩn gu.',
      basePrice: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1558857563-b37cf5a2b0e6?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p4444444-4444-4444-4444-222222222222',
      categoryId: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà sữa ô long nướng',
      description: 'Hương ô long nướng thơm lừng, hậu vị chát nhẹ ngọt hậu đậm đà.',
      basePrice: 39000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p4444444-4444-4444-4444-333333333333',
      categoryId: 'c4444444-4444-4444-4444-444444444444',
      name: 'Trà sữa Matcha',
      description: 'Bột matcha Uji Nhật Bản nguyên chất thơm nồng và béo thanh.',
      basePrice: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },

    // Nhóm 5: Đá Xay (cat-5)
    {
      id: 'p5555555-5555-5555-5555-111111111111',
      categoryId: 'c5555555-5555-5555-5555-555555555555',
      name: 'Cà phê đá xay Macchiato',
      description: 'Cà phê nguyên chất xay nhuyễn cùng đá tuyết, phủ lớp kem cheese béo mặn.',
      basePrice: 49000,
      imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
    {
      id: 'p5555555-5555-5555-5555-222222222222',
      categoryId: 'c5555555-5555-5555-5555-555555555555',
      name: 'Matcha đá xay kem tuyết',
      description: 'Matcha đậm vị kết hợp đá xay mịn màng và lớp kem whipping ngọt ngào.',
      basePrice: 49000,
      imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80',
      stock: 100,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        description: prod.description,
        basePrice: prod.basePrice,
        imageUrl: prod.imageUrl,
        stock: prod.stock,
        categoryId: prod.categoryId,
        isActive: true,
      },
      create: {
        id: prod.id,
        name: prod.name,
        description: prod.description,
        basePrice: prod.basePrice,
        imageUrl: prod.imageUrl,
        stock: prod.stock,
        categoryId: prod.categoryId,
        isActive: true,
      },
    });
  }
  console.log(`[Seed] Da tao ${products.length} mon do uong`);

  // 4. Khuyen mai (Vouchers)
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
      code: 'FREESHIP',
      discountType: 'FIXED_AMOUNT',
      discountValue: 15000,
      minOrderAmount: 50000,
      maxDiscountAmount: 15000,
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
  const defaultPasswordHash = await bcrypt.hash('Password123', 10);

  const users = [
    {
      id: 'u1111111-1111-1111-1111-111111111111',
      email: 'admin@brewlite.vn',
      passwordHash: defaultPasswordHash,
      fullName: 'Quản trị viên BrewLite',
      phone: '0901112222',
      role: 'ADMIN',
      loyaltyPoints: 1000,
    },
    {
      id: 'u2222222-2222-2222-2222-222222222222',
      email: 'khachhang@gmail.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Nguyễn Văn A',
      phone: '0903334444',
      role: 'CUSTOMER',
      loyaltyPoints: 50,
    },
    {
      id: 'u3333333-3333-3333-3333-333333333333',
      email: 'barista@brewlite.vn',
      passwordHash: defaultPasswordHash,
      fullName: 'Nhân viên Pha chế',
      phone: '0902223333',
      role: 'BARISTA',
      loyaltyPoints: 100,
    },
    {
      id: '08b739a8-8111-4561-8550-95d84b408c7e',
      email: 'duy.nguyen@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Nguyễn Duy',
      phone: '0901234567',
      role: 'CUSTOMER',
      loyaltyPoints: 131,
    },
    {
      id: 'a9d9fee5-6a07-4c1f-9683-602f040cfafb',
      email: 'tran.quang@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Trần Kỳ Quang',
      phone: '0988776655',
      role: 'CUSTOMER',
      loyaltyPoints: 260,
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: u.email }, { id: u.id }] },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          passwordHash: u.passwordHash,
          role: u.role,
          loyaltyPoints: u.loyaltyPoints,
        },
      });
    } else {
      await prisma.user.create({ data: u });
    }
  }
  console.log(`[Seed] Da tao/dong bo ${users.length} tai khoan nguoi dung mau (Mat khau mac dinh: Password123)`);

  // 6. Nguyen lieu (Ingredients) - Quan ly kho & cong thuc
  const ingredientsData = [
    { id: 'ing-1', name: 'Cà phê Robusta Đắk Lắk', unit: 'g', baseUnit: 'g', currentStock: 3000, minimumStock: 500, costPerUnit: 250 },
    { id: 'ing-2', name: 'Cà phê Arabica Cầu Đất', unit: 'g', baseUnit: 'g', currentStock: 2500, minimumStock: 400, costPerUnit: 400 },
    { id: 'ing-3', name: 'Sữa đặc Ông Thọ', unit: 'ml', baseUnit: 'ml', currentStock: 2500, minimumStock: 300, costPerUnit: 80 },
    { id: 'ing-4', name: 'Sữa tươi thanh trùng', unit: 'ml', baseUnit: 'ml', currentStock: 6000, minimumStock: 1000, costPerUnit: 35 },
    { id: 'ing-5', name: 'Đường mía lỏng', unit: 'ml', baseUnit: 'ml', currentStock: 4000, minimumStock: 500, costPerUnit: 20 },
    { id: 'ing-6', name: 'Đá viên tinh khiết', unit: 'g', baseUnit: 'g', currentStock: 50000, minimumStock: 5000, costPerUnit: 5 },
    { id: 'ing-7', name: 'Ly dùng một lần & nắp', unit: 'piece', baseUnit: 'piece', currentStock: 200, minimumStock: 50, costPerUnit: 800 },
    { id: 'ing-8', name: 'Ống hút giấy sinh học', unit: 'piece', baseUnit: 'piece', currentStock: 250, minimumStock: 50, costPerUnit: 150 },
    { id: 'ing-9', name: 'Kem béo thực vật muối biển', unit: 'ml', baseUnit: 'ml', currentStock: 3000, minimumStock: 300, costPerUnit: 120 },
    { id: 'ing-10', name: 'Sốt Caramel Davinci', unit: 'ml', baseUnit: 'ml', currentStock: 2000, minimumStock: 200, costPerUnit: 250 },
    { id: 'ing-11', name: 'Trà đen Ceylon', unit: 'g', baseUnit: 'g', currentStock: 3000, minimumStock: 300, costPerUnit: 180 },
    { id: 'ing-12', name: 'Trà lài Bảo Lộc', unit: 'g', baseUnit: 'g', currentStock: 3000, minimumStock: 300, costPerUnit: 200 },
    { id: 'ing-13', name: 'Trà Ô long nướng', unit: 'g', baseUnit: 'g', currentStock: 3000, minimumStock: 300, costPerUnit: 220 },
    { id: 'ing-14', name: 'Bột Matcha Uji Nhật Bản', unit: 'g', baseUnit: 'g', currentStock: 1000, minimumStock: 150, costPerUnit: 1200 },
    { id: 'ing-15', name: 'Bột Cacao nguyên chất', unit: 'g', baseUnit: 'g', currentStock: 1500, minimumStock: 200, costPerUnit: 300 },
    { id: 'ing-16', name: 'Syrup Đào & Đào ngâm', unit: 'ml', baseUnit: 'ml', currentStock: 3000, minimumStock: 300, costPerUnit: 150 },
    { id: 'ing-17', name: 'Syrup Vải thiều', unit: 'ml', baseUnit: 'ml', currentStock: 3000, minimumStock: 300, costPerUnit: 150 },
  ];

  for (const ing of ingredientsData) {
    await prisma.ingredient.upsert({
      where: { id: ing.id },
      update: {
        name: ing.name,
        unit: ing.unit,
        baseUnit: ing.baseUnit,
        currentStock: ing.currentStock,
        minimumStock: ing.minimumStock,
        costPerUnit: ing.costPerUnit,
      },
      create: {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        baseUnit: ing.baseUnit,
        currentStock: ing.currentStock,
        minimumStock: ing.minimumStock,
        costPerUnit: ing.costPerUnit,
      },
    });
  }
  console.log(`[Seed] Da tao ${ingredientsData.length} loai nguyen lieu kho`);

  // 7. Cong thuc san pham (Product Recipes / Bill of Materials)
  await prisma.productRecipe.deleteMany({});

  const recipes = [
    // 1. Cà phê đen đá (p1111111-1111-1111-1111-111111111111)
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-1', size: 'S', amount: 20, wasteRate: 5 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-6', size: 'S', amount: 150, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-7', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-8', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-1', size: 'M', amount: 25, wasteRate: 5 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-6', size: 'M', amount: 180, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-8', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-1', size: 'L', amount: 30, wasteRate: 5 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-6', size: 'L', amount: 220, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-7', size: 'L', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-111111111111', ingredientId: 'ing-8', size: 'L', amount: 1, wasteRate: 0 },

    // 2. Cà phê sữa đá (p1111111-1111-1111-1111-222222222222) - Chuẩn công thức theo Prompt
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-1', size: 'S', amount: 20, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-3', size: 'S', amount: 30, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-6', size: 'S', amount: 150, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-7', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-8', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-1', size: 'M', amount: 25, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-3', size: 'M', amount: 35, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-6', size: 'M', amount: 180, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-8', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-1', size: 'L', amount: 30, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-3', size: 'L', amount: 45, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-6', size: 'L', amount: 220, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-7', size: 'L', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-222222222222', ingredientId: 'ing-8', size: 'L', amount: 1, wasteRate: 0 },

    // 3. Bạc xỉu (p1111111-1111-1111-1111-333333333333) - Chuẩn công thức theo Prompt
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-1', size: 'S', amount: 15, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-3', size: 'S', amount: 25, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-4', size: 'S', amount: 100, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-6', size: 'S', amount: 150, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-7', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-8', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-1', size: 'M', amount: 18, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-3', size: 'M', amount: 30, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-4', size: 'M', amount: 130, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-6', size: 'M', amount: 180, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-8', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-1', size: 'L', amount: 22, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-3', size: 'L', amount: 35, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-4', size: 'L', amount: 160, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-6', size: 'L', amount: 220, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-7', size: 'L', amount: 1, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-333333333333', ingredientId: 'ing-8', size: 'L', amount: 1, wasteRate: 0 },

    // 4. Trà sữa Matcha (Matcha sữa - p4444444-4444-4444-4444-333333333333) - Chuẩn công thức theo Prompt
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-14', size: 'S', amount: 5, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-4', size: 'S', amount: 150, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-5', size: 'S', amount: 10, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-6', size: 'S', amount: 150, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-7', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-8', size: 'S', amount: 1, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-14', size: 'M', amount: 7, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-4', size: 'M', amount: 200, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-5', size: 'M', amount: 15, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-6', size: 'M', amount: 180, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-8', size: 'M', amount: 1, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-14', size: 'L', amount: 10, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-4', size: 'L', amount: 250, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-5', size: 'L', amount: 20, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-6', size: 'L', amount: 220, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-7', size: 'L', amount: 1, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-333333333333', ingredientId: 'ing-8', size: 'L', amount: 1, wasteRate: 0 },

    // 5. Cà phê muối (p1111111-1111-1111-1111-444444444444)
    { productId: 'p1111111-1111-1111-1111-444444444444', ingredientId: 'ing-1', size: 'M', amount: 25, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-444444444444', ingredientId: 'ing-3', size: 'M', amount: 20, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-444444444444', ingredientId: 'ing-9', size: 'M', amount: 40, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-444444444444', ingredientId: 'ing-6', size: 'M', amount: 150, wasteRate: 0 },
    { productId: 'p1111111-1111-1111-1111-444444444444', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },

    // 6. Americano (p2222222-2222-2222-2222-111111111111)
    { productId: 'p2222222-2222-2222-2222-111111111111', ingredientId: 'ing-2', size: 'M', amount: 18, wasteRate: 0 },
    { productId: 'p2222222-2222-2222-2222-111111111111', ingredientId: 'ing-6', size: 'M', amount: 180, wasteRate: 0 },
    { productId: 'p2222222-2222-2222-2222-111111111111', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },

    // 7. Latte (p2222222-2222-2222-2222-222222222222)
    { productId: 'p2222222-2222-2222-2222-222222222222', ingredientId: 'ing-2', size: 'M', amount: 18, wasteRate: 0 },
    { productId: 'p2222222-2222-2222-2222-222222222222', ingredientId: 'ing-4', size: 'M', amount: 200, wasteRate: 0 },
    { productId: 'p2222222-2222-2222-2222-222222222222', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },

    // 8. Trà đào cam sả (p3333333-3333-3333-3333-111111111111)
    { productId: 'p3333333-3333-3333-3333-111111111111', ingredientId: 'ing-11', size: 'M', amount: 15, wasteRate: 0 },
    { productId: 'p3333333-3333-3333-3333-111111111111', ingredientId: 'ing-16', size: 'M', amount: 40, wasteRate: 0 },
    { productId: 'p3333333-3333-3333-3333-111111111111', ingredientId: 'ing-6', size: 'M', amount: 150, wasteRate: 0 },
    { productId: 'p3333333-3333-3333-3333-111111111111', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },

    // 9. Trà sữa truyền thống (p4444444-4444-4444-4444-111111111111)
    { productId: 'p4444444-4444-4444-4444-111111111111', ingredientId: 'ing-11', size: 'M', amount: 15, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-111111111111', ingredientId: 'ing-4', size: 'M', amount: 120, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-111111111111', ingredientId: 'ing-3', size: 'M', amount: 25, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-111111111111', ingredientId: 'ing-6', size: 'M', amount: 150, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-111111111111', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },

    // 10. Trà sữa ô long nướng (p4444444-4444-4444-4444-222222222222)
    { productId: 'p4444444-4444-4444-4444-222222222222', ingredientId: 'ing-13', size: 'M', amount: 15, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-222222222222', ingredientId: 'ing-4', size: 'M', amount: 120, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-222222222222', ingredientId: 'ing-3', size: 'M', amount: 25, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-222222222222', ingredientId: 'ing-6', size: 'M', amount: 150, wasteRate: 0 },
    { productId: 'p4444444-4444-4444-4444-222222222222', ingredientId: 'ing-7', size: 'M', amount: 1, wasteRate: 0 },
  ];

  for (const r of recipes) {
    await prisma.productRecipe.create({
      data: {
        productId: r.productId,
        ingredientId: r.ingredientId,
        size: r.size,
        amount: r.amount,
        wasteRate: r.wasteRate || 0,
      },
    });
  }
  console.log(`[Seed] Da tao ${recipes.length} dinh luong cong thuc san pham mau (BOM)`);

  // 8. Tao phieu nhap kho ban dau (Stock Receipt)
  const initialReceiptCode = 'PNK-2026-0001';
  let totalReceiptCost = 0;
  const receiptItemsData = ingredientsData.map((ing) => {
    const total = ing.currentStock * ing.costPerUnit;
    totalReceiptCost += total;
    return {
      ingredientId: ing.id,
      quantity: ing.currentStock,
      unitCost: ing.costPerUnit,
      totalPrice: total,
    };
  });

  const stockReceipt = await prisma.stockReceipt.upsert({
    where: { receiptCode: initialReceiptCode },
    update: { totalCost: totalReceiptCost },
    create: {
      receiptCode: initialReceiptCode,
      supplier: 'Tong kho Nguyen lieu BrewLite Viet Nam',
      totalCost: totalReceiptCost,
      notes: 'Nhap kho khoi tao he thong',
      receivedById: 'u1111111-1111-1111-1111-111111111111',
    },
  });

  await prisma.stockReceiptItem.deleteMany({ where: { receiptId: stockReceipt.id } });
  for (const item of receiptItemsData) {
    await prisma.stockReceiptItem.create({
      data: {
        receiptId: stockReceipt.id,
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalPrice: item.totalPrice,
      },
    });

    // Luu lich su bien dong kho
    await prisma.inventoryTransaction.create({
      data: {
        ingredientId: item.ingredientId,
        type: 'RECEIPT',
        quantity: item.quantity,
        balanceAfter: item.quantity,
        referenceType: 'STOCK_RECEIPT',
        stockReceiptId: stockReceipt.id,
        notes: `Nhap kho ban dau theo phieu ${initialReceiptCode}`,
      },
    });
  }
  console.log(`[Seed] Da tao phieu nhap kho ban dau ${initialReceiptCode} va cap nhat so nhat ky kho`);

  console.log('[Seed] Hoan tat nap du lieu mau moi thanh cong 100%.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
