// API client kết nối tới Backend NestJS cho BrewLite (Task 3 & Task 4 - Duy)

import { DRINKS, CATEGORIES as FALLBACK_CATEGORIES } from './data';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ApiTopping {
  id: string;
  name: string;
  price: number | string;
  stock?: number;
  isAvailable?: boolean;
}

export interface ApiProduct {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number | string;
  imageUrl?: string | null;
  stock?: number;
  categoryId?: string;
  category?: ApiCategory;
  isActive?: boolean;
}

// Cấu trúc sản phẩm chuẩn hóa hiển thị trên UI Frontend
export interface NormalizedProduct {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  categoryId?: string;
  basePrice: number;
  image: string;
  largeImage?: string;
  bestseller?: boolean;
  description: string;
  stock: number;
}

// Dữ liệu topping dự phòng phong phú đúng theo CSDL backend
export const FALLBACK_TOPPINGS: ApiTopping[] = [
  { id: 't1111111-1111-1111-1111-111111111111', name: 'Trân châu đen', price: 10000 },
  { id: 't2222222-2222-2222-2222-222222222222', name: 'Trân châu trắng 3Q', price: 10000 },
  { id: 't3333333-3333-3333-3333-333333333333', name: 'Thạch cà phê', price: 10000 },
  { id: 't4444444-4444-4444-4444-444444444444', name: 'Thạch củ năng', price: 10000 },
  { id: 't5555555-5555-5555-5555-555555555555', name: 'Kem Macchiato phô mai', price: 12000 },
  { id: 't6666666-6666-6666-6666-666666666666', name: 'Đào ngâm miếng', price: 12000 },
  { id: 't7777777-7777-7777-7777-777777777777', name: 'Hạt sen tươi', price: 12000 },
  { id: 'extra-shot', name: 'Extra shot espresso', price: 10000 },
  { id: 'caramel-drizzle', name: 'Caramel drizzle', price: 5000 },
];

/**
 * Chuẩn hóa sản phẩm từ API backend sang cấu trúc đồng nhất cho UI
 */
export function normalizeProduct(apiItem: ApiProduct): NormalizedProduct {
  const priceNum = typeof apiItem.basePrice === 'number'
    ? apiItem.basePrice
    : parseFloat(String(apiItem.basePrice)) || 0;

  // Lấy ảnh mặc định nếu backend không có ảnh
  const defaultImage =
    apiItem.imageUrl && apiItem.imageUrl.trim() !== ''
      ? apiItem.imageUrl
      : '/images/hero-drink.png';

  const categoryName = apiItem.category?.name || 'Cà phê';

  return {
    id: apiItem.id,
    name: apiItem.name,
    subtitle: apiItem.description
      ? apiItem.description.slice(0, 40) + (apiItem.description.length > 40 ? '...' : '')
      : 'Thức uống thủ công pha mới',
    category: categoryName,
    categoryId: apiItem.categoryId,
    basePrice: priceNum,
    image: defaultImage,
    largeImage: defaultImage,
    bestseller: false,
    description: apiItem.description || 'Thức uống được pha chế tỉ mỉ từ nguyên liệu tươi ngon.',
    stock: apiItem.stock ?? 100,
  };
}

/**
 * Chuyển đổi dữ liệu fallback từ DRINKS tĩnh sang NormalizedProduct
 */
export function getFallbackProducts(): NormalizedProduct[] {
  return DRINKS.map((d) => ({
    id: d.id,
    name: d.name,
    subtitle: d.subtitle,
    category: d.category,
    basePrice: d.basePrice,
    image: d.image,
    largeImage: d.largeImage,
    bestseller: d.bestseller,
    description: d.description,
    stock: 100,
  }));
}

/**
 * Lấy danh sách sản phẩm từ backend (GET /products)
 * Có hỗ trợ tham số lọc categoryId và tìm kiếm search
 */
export async function fetchProducts(params?: {
  categoryId?: string;
  search?: string;
}): Promise<{ products: NormalizedProduct[]; isFromApi: boolean }> {
  try {
    const url = new URL(`${API_BASE_URL}/products`);
    if (params?.categoryId && params.categoryId !== 'all') {
      url.searchParams.append('categoryId', params.categoryId);
    }
    if (params?.search && params.search.trim()) {
      url.searchParams.append('search', params.search.trim());
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`API trả về mã lỗi: ${res.status}`);
    }

    const data: ApiProduct[] = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        products: data.map(normalizeProduct),
        isFromApi: true,
      };
    }

    // Nếu API trả về mảng rỗng nhưng thành công
    return {
      products: [],
      isFromApi: true,
    };
  } catch (error) {
    console.warn('[FetchProducts] Không thể kết nối backend API, chuyển sang dữ liệu dự phòng:', error);
    // Trả về dữ liệu dự phòng
    let fallback = getFallbackProducts();
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      fallback = fallback.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    return {
      products: fallback,
      isFromApi: false,
    };
  }
}

/**
 * Lấy danh sách danh mục đồ uống từ backend (GET /categories)
 */
export async function fetchCategories(): Promise<{ categories: { id: string; name: string }[]; isFromApi: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/categories`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Lỗi categories API: ${res.status}`);
    }

    const data: ApiCategory[] = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        categories: [
          { id: 'all', name: 'Tất cả đồ uống' },
          ...data.map((c) => ({ id: c.id, name: c.name })),
        ],
        isFromApi: true,
      };
    }
  } catch (error) {
    console.warn('[FetchCategories] Backend offline, dùng danh mục dự phòng:', error);
  }

  return {
    categories: FALLBACK_CATEGORIES.map((cat, idx) => ({
      id: idx === 0 ? 'all' : `cat-${idx}`,
      name: cat,
    })),
    isFromApi: false,
  };
}

/**
 * Lấy thông tin chi tiết một sản phẩm (GET /products/:id)
 */
export async function fetchProductById(id: string): Promise<NormalizedProduct | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: ApiProduct = await res.json();
      if (data && data.id) {
        return normalizeProduct(data);
      }
    }
  } catch (error) {
    console.warn(`[FetchProductById] Không tải được chi tiết món id ${id} từ API:`, error);
  }

  // Fallback từ DRINKS tĩnh
  const found = DRINKS.find((d) => d.id === id);
  if (found) {
    return {
      id: found.id,
      name: found.name,
      subtitle: found.subtitle,
      category: found.category,
      basePrice: found.basePrice,
      image: found.image,
      largeImage: found.largeImage,
      bestseller: found.bestseller,
      description: found.description,
      stock: 100,
    };
  }

  return null;
}

/**
 * Lấy danh sách Topping từ backend (GET /toppings)
 */
export async function fetchToppings(): Promise<ApiTopping[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/toppings`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: ApiTopping[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t) => ({
          ...t,
          price: typeof t.price === 'number' ? t.price : parseFloat(String(t.price)) || 10000,
        }));
      }
    }
  } catch (error) {
    console.warn('[FetchToppings] Dùng danh sách topping dự phòng:', error);
  }

  return FALLBACK_TOPPINGS;
}
