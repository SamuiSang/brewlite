'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { MapPin, Plus, Check, X } from 'lucide-react';
import { DRINKS, CATEGORIES, formatVND } from '@/lib/data';
import { useCartStore } from '@/lib/store';
import FloatingCartBar from '@/components/FloatingCartBar';

export default function MenuContent() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';

  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả đồ uống');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const addItem = useCartStore((state) => state.addItem);

  const filteredDrinks = DRINKS.filter((drink) => {
    const matchesCategory =
      selectedCategory === 'Tất cả đồ uống' || drink.category === selectedCategory;

    const matchesSearch =
      !search ||
      drink.name.toLowerCase().includes(search.toLowerCase()) ||
      drink.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      drink.description.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleQuickAdd = (drink: (typeof DRINKS)[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      drinkId: drink.id,
      name: drink.name,
      subtitle: drink.subtitle,
      image: drink.image,
      size: 'S',
      sizeLabel: 'Regular',
      milk: 'dairy',
      milkLabel: 'Dairy milk',
      toppings: [],
      toppingsLabels: [],
      note: '',
      unitPrice: drink.basePrice,
      quantity: 1,
      optionsLabel: 'Regular · Dairy milk',
    });

    setAddedId(drink.id);
    setToastMessage(`Added 1 ${drink.name} to cart`);
    setTimeout(() => setAddedId(null), 1200);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="flex-1 pb-12 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#163d2c] text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-[#24523c] flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner Section */}
      <section className="bg-[#163d2c] text-[#f7f4ee] py-10 sm:py-14 border-b border-[#123324]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="text-xs text-[#a3b8ab] mb-4 flex items-center gap-2">
            <span>Menu</span>
            <span>/</span>
            <span className="text-white">Tất cả đồ uống</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Hero Content */}
            <div className="md:col-span-7 flex flex-col justify-center">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#d6955b] mb-3">
                NGÀY CỦA BẠN
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                Tìm cà phê của bạn
              </h1>
              <p className="text-sm sm:text-base text-[#c2d1c7] mb-3">
  Một vài món quen thuộc, theo cách bạn thích.
</p>

<h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
  Một ly cà phê ngon, đúng gu của bạn.
</h2>
              <p className="text-xs sm:text-sm text-[#a3b8ab] max-w-lg">
                Làm kỹ lưỡng. Phù hợp với ngày của bạn.
              </p>
            </div>

            {/* Right Hero Image */}
            <div className="md:col-span-5 flex justify-center md:justify-end">
              <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-[#234d39]">
                <Image
                  src="/images/hero-drink.png"
                  alt="Iced specialty coffee with oat milk"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* Pickup Location Card */}
        <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 mb-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
            <MapPin className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
  <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
    ĐỊA ĐIỂM NHẬN HÀNG
  </span>
  <h3 className="font-semibold text-sm text-[#163d2c]">
    Brewlite · Quận 3
  </h3>
  <p className="text-xs text-[#526658]">
    Dự kiến hoàn thành trong 8–12 phút
  </p>
  <p className="text-[11px] text-[#697f70]">
    Nhận trực tiếp tại quầy, không giao hàng.
  </p>
</div>
        </div>

        {/* Search status filter indicator */}
        {search && (
  <div className="mb-6 flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-[#e8e2d7]">
    <span className="text-xs text-[#55695c]">
      Kết quả tìm kiếm: <strong className="text-[#163d2c]">&ldquo;{search}&rdquo;</strong>
    </span>
    <Link
      href="/"
      className="text-xs text-red-700 hover:underline flex items-center gap-1 font-semibold"
    >
      <X className="w-3.5 h-3.5" />
      <span>Xóa tìm kiếm</span>
    </Link>
  </div>
)}

{/* Bộ lọc danh mục */}
<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-8">
  {CATEGORIES.map((cat) => {
    const isActive = selectedCategory === cat;
    return (
      <button
        key={cat}
        onClick={() => setSelectedCategory(cat)}
        className={`text-xs px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-[#163d2c] text-white shadow-sm'
            : 'bg-[#ede7dc] text-[#526359] hover:bg-[#e4ddd0]'
        }`}
      >
        {cat}
      </button>
    );
  })}
</div>
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
    Món được yêu thích
  </h2>
  <span className="text-xs text-[#6e7d73] font-medium">
    {filteredDrinks.length} món · Phổ biến ▾
  </span>
</div>

        {/* Product Cards Grid */}
        {filteredDrinks.length === 0 ? (
  <div className="bg-white rounded-3xl p-12 text-center border border-[#e8e2d7] text-sm text-[#708076]">
    Không tìm thấy đồ uống phù hợp. Hãy thử chọn danh mục khác hoặc xóa nội dung tìm kiếm.
  </div>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {filteredDrinks.map((drink) => (
      <div
        key={drink.id}
        className="bg-white rounded-2xl overflow-hidden border border-[#e8e2d7] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
      >
        {/* Ảnh sản phẩm */}
        <Link
          href={`/customize/${drink.id}`}
          className="relative w-full aspect-[16/10] overflow-hidden bg-[#e8e2d8] block"
        >
          <Image
            src={drink.image}
            alt={drink.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

                {/* Product Info */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <Link href={`/customize/${drink.id}`}>
                      <h3 className="font-serif text-lg font-bold text-[#14241b] hover:text-[#163d2c] transition-colors">
                        {drink.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-[#708076] mt-1 mb-4">
                      {drink.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f2eee7]">
                    <span className="font-serif text-base font-bold text-[#14241b]">
                      {formatVND(drink.basePrice)}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/customize/${drink.id}`}
                        className="text-xs font-semibold text-[#66776c] hover:text-[#163d2c] px-2 py-1 rounded transition-colors"
                      >
                        Tùy chỉnh
                      </Link>

                      <button
                        onClick={(e) => handleQuickAdd(drink, e)}
                        title="Thêm nhanh vào giỏ hàng"
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                          addedId === drink.id
                            ? 'bg-emerald-600 text-white scale-110'
                            : 'bg-[#d6955b] hover:bg-[#c4844a] text-white active:scale-95'
                        }`}
                      >
                        {addedId === drink.id ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
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

        {/* Floating Cart Bar */}
        <FloatingCartBar />
      </div>
    </div>
  );
}
