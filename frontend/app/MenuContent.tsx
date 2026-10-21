'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Plus, Check, X, RefreshCw, Coffee, AlertCircle } from 'lucide-react';
import { formatVND } from '@/lib/data';
import { useCartStore } from '@/lib/store';
import FloatingCartBar from '@/components/FloatingCartBar';
import {
  fetchProducts,
  fetchCategories,
  NormalizedProduct,
} from '@/lib/api';

export default function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';

  // Quản lý trạng thái danh mục và sản phẩm
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isApiConnected, setIsApiConnected] = useState<boolean>(true);

  // Hiệu ứng tương tác thêm nhanh
  const [addedId, setAddedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const addItem = useCartStore((state) => state.addItem);

  // Hàm tải dữ liệu danh mục từ API backend (Task 3)
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchCategories();
      setCategories(res.categories);
    } catch (err) {
      console.error('Lỗi khi tải danh mục đồ uống:', err);
    }
  }, []);

  // Hàm tải danh sách sản phẩm từ backend /products (Task 3)
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await fetchProducts({
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
        search: search,
      });

      setProducts(res.products);
      setIsApiConnected(res.isFromApi);
    } catch (err) {
      console.error('Lỗi khi gọi API /products:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, search]);

  // Khởi tạo và nạp dữ liệu khi mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Xử lý chuyển đổi danh mục
  const handleSelectCategory = (categoryId: string) => {
    startTransition(() => {
      setSelectedCategory(categoryId);
    });
  };

  // Xóa bộ lọc tìm kiếm
  const handleClearSearch = () => {
    router.push('/');
  };

  // Thêm nhanh vào giỏ hàng (Size mặc định S)
  const handleQuickAdd = (product: NormalizedProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      drinkId: product.id,
      name: product.name,
      subtitle: product.subtitle,
      image: product.image,
      size: 'S',
      sizeLabel: 'Regular',
      milk: 'dairy',
      milkLabel: 'Sữa tươi tiêu chuẩn',
      toppings: [],
      toppingsLabels: [],
      note: '',
      unitPrice: product.basePrice,
      quantity: 1,
      optionsLabel: 'Regular · Sữa tươi tiêu chuẩn',
    });

    setAddedId(product.id);
    setToastMessage(`Đã thêm 1 ${product.name} vào giỏ hàng`);
    setTimeout(() => setAddedId(null), 1200);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="flex-1 pb-16 relative bg-[#fbf9f5]">
      {/* Thông báo Toast khi thêm món thành công */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#163d2c] text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-[#24523c] flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner Section - Đúng thiết kế Figma */}
      <section className="bg-[#163d2c] text-[#f7f4ee] py-10 sm:py-14 border-b border-[#123324]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb dẫn hướng */}
          <div className="text-xs text-[#a3b8ab] mb-4 flex items-center gap-2">
            <span>Menu</span>
            <span>/</span>
            <span className="text-white">Tất cả đồ uống</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Nội dung bên trái */}
            <div className="md:col-span-7 flex flex-col justify-center">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#d6955b] mb-3">
                KHOẢNH KHẮC MỖI NGÀY
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 leading-[1.1]">
                Tìm cà phê của bạn
              </h1>
              <p className="text-sm sm:text-base text-[#c2d1c7] mb-3">
                Một vài món quen thuộc, theo cách bạn thích.
              </p>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
                Một ly cà phê ngon, đúng gu của bạn.
              </h2>
              <p className="text-xs sm:text-sm text-[#a3b8ab] max-w-lg">
                Pha chế thủ công tỉ mỉ. Khởi đầu ngày mới tràn đầy cảm hứng.
              </p>
            </div>

            {/* Ảnh minh họa bên phải */}
            <div className="md:col-span-5 flex justify-center md:justify-end">
              <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-[#234d39]">
                <Image
                  src="/images/drinks/hero-drink.png"
                  alt="Ly cà phê kem béo mát lạnh BrewLite"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Khu vực nội dung chính */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* Thẻ thông tin địa điểm nhận hàng tại quầy (Order & Pick-up) */}
        <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 mb-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
            <MapPin className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
              ĐỊA ĐIỂM NHẬN NƯỚC (PICK-UP)
            </span>
            <h3 className="font-semibold text-sm text-[#163d2c]">
              BrewLite · Chi nhánh Quận 3
            </h3>
            <p className="text-xs text-[#526658]">
              Dự kiến pha chế hoàn thành trong 8–12 phút
            </p>
            <p className="text-[11px] text-[#697f70]">
              Nhận trực tiếp tại quầy theo mã đơn, không xếp hàng chờ đợi.
            </p>
          </div>
        </div>

        {/* Thanh trạng thái tìm kiếm (nếu đang tìm) */}
        {search && (
          <div className="mb-6 flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-[#e8e2d7] shadow-xs">
            <span className="text-xs text-[#55695c]">
              Kết quả tìm kiếm cho: <strong className="text-[#163d2c]">&ldquo;{search}&rdquo;</strong>
            </span>
            <button
              onClick={handleClearSearch}
              className="text-xs text-red-700 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        )}

        {/* Bộ lọc danh mục (Tabs) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-8">
          {categories.length > 0 ? (
            categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`text-xs px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#163d2c] text-white shadow-sm'
                      : 'bg-[#ede7dc] text-[#526359] hover:bg-[#e4ddd0]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })
          ) : (
            // Skeleton cho tabs danh mục khi đang tải
            <div className="flex gap-2 animate-pulse">
              <div className="h-8 w-28 bg-[#e8e2d7] rounded-full" />
              <div className="h-8 w-24 bg-[#e8e2d7] rounded-full" />
              <div className="h-8 w-24 bg-[#e8e2d7] rounded-full" />
            </div>
          )}
        </div>

        {/* Tiêu đề mục sản phẩm */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
            Món được yêu thích
          </h2>
          <div className="flex items-center gap-3">
            {!isLoading && (
              <span className="text-xs text-[#6e7d73] font-medium">
                {products.length} món đồ uống
              </span>
            )}
            <button
              onClick={() => loadProducts()}
              title="Làm mới danh sách"
              className="p-1.5 rounded-lg text-[#6e7d73] hover:text-[#163d2c] hover:bg-[#ede7dc] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#163d2c]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Thông báo kết nối dữ liệu */}
        {!isApiConnected && !isLoading && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Đang hiển thị menu ngoại tuyến (Backend NestJS chưa kết nối hoặc đang khởi động).</span>
            </div>
            <button
              onClick={() => loadProducts()}
              className="underline font-semibold hover:text-amber-950 cursor-pointer"
            >
              Thử kết nối lại
            </button>
          </div>
        )}

        {/* LƯỚI SẢN PHẨM: XỬ LÝ 3 TRẠNG THÁI (Loading, Empty, Success) */}

        {/* 1. Trạng thái Đang tải (Loading Skeleton) */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden border border-[#e8e2d7] shadow-xs flex flex-col animate-pulse"
              >
                <div className="w-full aspect-[16/10] bg-[#e4dfd5]" />
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="h-5 bg-[#e4dfd5] rounded w-3/4 mb-2" />
                    <div className="h-3.5 bg-[#eae5dc] rounded w-1/2 mb-4" />
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#f2eee7]">
                    <div className="h-5 bg-[#e4dfd5] rounded w-20" />
                    <div className="w-8 h-8 rounded-full bg-[#e4dfd5]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Trạng thái Không có sản phẩm (Empty State) */}
        {!isLoading && products.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#e8e2d7] shadow-xs my-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#ede7dc] flex items-center justify-center mx-auto mb-4 text-[#708076]">
              <Coffee className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#14241b] mb-2">
              Không tìm thấy đồ uống phù hợp
            </h3>
            <p className="text-xs text-[#708076] mb-6">
              {search
                ? `Không có kết quả nào cho "${search}". Hãy thử từ khóa khác hoặc xóa tìm kiếm.`
                : 'Danh mục này hiện tại chưa có món. Bạn vui lòng chọn danh mục khác nhé!'}
            </p>
            <div className="flex justify-center gap-3">
              {search && (
                <button
                  onClick={handleClearSearch}
                  className="px-4 py-2 bg-[#ede7dc] hover:bg-[#e4ddd0] text-[#163d2c] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Xóa tìm kiếm
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  if (search) handleClearSearch();
                }}
                className="px-4 py-2 bg-[#163d2c] hover:bg-[#1f4e39] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Xem tất cả đồ uống
              </button>
            </div>
          </div>
        )}

        {/* 3. Trạng thái Hiển thị danh sách sản phẩm (Success State) */}
        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden border border-[#e8e2d7] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
              >
                {/* Ảnh món */}
                <Link
                  href={`/customize/${product.id}`}
                  className="relative w-full aspect-[16/10] overflow-hidden bg-[#e8e2d8] block"
                >
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {product.bestseller && (
                    <span className="absolute top-3 left-3 bg-[#163d2c] text-[#f7f4ee] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm">
                      BÁN CHẠY
                    </span>
                  )}
                </Link>

                {/* Thông tin món */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-[#7a8a7f] uppercase tracking-wider mb-1">
                      {product.category}
                    </div>
                    <Link href={`/customize/${product.id}`}>
                      <h3 className="font-serif text-lg font-bold text-[#14241b] hover:text-[#163d2c] transition-colors leading-snug">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-[#708076] mt-1.5 mb-4 line-clamp-2">
                      {product.subtitle || product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#f2eee7]">
                    <span className="font-serif text-base font-bold text-[#14241b]">
                      {formatVND(product.basePrice)}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/customize/${product.id}`}
                        className="text-xs font-semibold text-[#546b5a] hover:text-[#163d2c] bg-[#f4f1ea] hover:bg-[#ece6db] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Tùy chỉnh
                      </Link>

                      <button
                        onClick={(e) => handleQuickAdd(product, e)}
                        title="Thêm nhanh vào giỏ hàng (Size S)"
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                          addedId === product.id
                            ? 'bg-emerald-600 text-white scale-110'
                            : 'bg-[#d6955b] hover:bg-[#c4844a] text-white active:scale-95'
                        }`}
                      >
                        {addedId === product.id ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Thanh xem giỏ hàng nổi phía dưới */}
        <FloatingCartBar />
      </div>
    </div>
  );
}
